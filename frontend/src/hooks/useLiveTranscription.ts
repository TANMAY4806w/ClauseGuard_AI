import { useState, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';

export interface UseLiveTranscriptionOptions {
  /**
   * Called whenever a finalized chunk arrives (or when mic is stopped).
   * @param fullText The full accumulated text for the current recording session.
   * @param latestChunk The specific final chunk just recognized.
   */
  onTranscriptUpdate?: (fullText: string, latestChunk: string) => void;
  /**
   * Called on every interim streaming update while speaking.
   * @param partialText The current partial words being spoken.
   */
  onPartialUpdate?: (partialText: string) => void;
  /**
   * Called when an error occurs during token minting, mic access, or WebSocket streaming.
   */
  onError?: (err: string) => void;
}

/**
 * Resamples audio buffer from input sample rate to target 16kHz Int16 linear PCM.
 * Compatible with any hardware sample rate (44.1kHz, 48kHz, 96kHz, 16kHz).
 */
function downsampleTo16kHz(buffer: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === 16000) {
    const pcm16 = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }

  const sampleRateRatio = inputSampleRate / 16000;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    const avg = count > 0 ? accum / count : 0;
    const s = Math.max(-1, Math.min(1, avg));
    result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

export function useLiveTranscription(options: UseLiveTranscriptionOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [fullTranscript, setFullTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const accumulatedRef = useRef<string>('');
  const latestPartialRef = useRef<string>('');
  const optionsRef = useRef<UseLiveTranscriptionOptions>(options);

  // Keep optionsRef updated to prevent stale closures in async callbacks
  optionsRef.current = options;

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setIsConnecting(false);
    setAudioLevel(0);

    // If there is any uncommitted partial speech when stopping, commit it immediately
    const lingering = latestPartialRef.current.trim();
    if (lingering) {
      accumulatedRef.current = accumulatedRef.current
        ? `${accumulatedRef.current} ${lingering}`
        : lingering;
      setFullTranscript(accumulatedRef.current);
      optionsRef.current.onTranscriptUpdate?.(accumulatedRef.current, lingering);
      latestPartialRef.current = '';
    }
    setPartialTranscript('');

    // Disconnect audio nodes
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      gainNodeRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    // Terminate and close WebSocket
    if (socketRef.current) {
      const ws = socketRef.current;
      socketRef.current = null;
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'Terminate' }));
        } catch {
          // ignore
        }
      }
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setIsConnecting(true);
      latestPartialRef.current = '';

      // 1. Fetch short-lived streaming token from backend
      const voiceTokenData = await apiClient.getVoiceToken();
      let wsUrl = `${voiceTokenData.websocket_url}&token=${encodeURIComponent(voiceTokenData.token)}`;
      if (!wsUrl.includes('format_turns=')) {
        wsUrl += '&format_turns=true';
      }

      // 2. Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 3. Initialize WebSocket connection to AssemblyAI v3
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = async () => {
        setIsConnecting(false);
        setIsRecording(true);

        try {
          // 4. Setup AudioContext and PCM streaming
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          let audioCtx: AudioContext;
          try {
            audioCtx = new AudioCtx({ sampleRate: 16000 });
          } catch {
            audioCtx = new AudioCtx();
          }
          audioContextRef.current = audioCtx;

          // CRITICAL FOR CHROME/EDGE: Ensure AudioContext is resumed if suspended by browser autoplay policy
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }

          const source = audioCtx.createMediaStreamSource(stream);
          // ScriptProcessor buffer size: 4096 samples (~256ms at 16kHz, ~85ms at 48kHz)
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          // Mute gain node to prevent speaker feedback loop
          const zeroGain = audioCtx.createGain();
          zeroGain.gain.value = 0;
          gainNodeRef.current = zeroGain;

          processor.onaudioprocess = (e) => {
            if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);

            // Compute real-time volume level for visual soundwave feedback
            let sumSquare = 0;
            for (let i = 0; i < inputData.length; i++) {
              sumSquare += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sumSquare / inputData.length);
            const level = Math.min(100, Math.round(rms * 400));
            setAudioLevel(level);

            // Downsample input audio to standard 16kHz Int16 linear PCM
            const pcm16 = downsampleTo16kHz(inputData, audioCtx.sampleRate);

            // Send raw binary PCM audio buffer over WebSocket
            socketRef.current.send(pcm16.buffer as ArrayBuffer);
          };

          source.connect(processor);
          processor.connect(zeroGain);
          zeroGain.connect(audioCtx.destination);
        } catch (setupErr) {
          console.error('[AssemblyAI] AudioContext setup failed:', setupErr);
          optionsRef.current.onError?.('Could not activate audio processor.');
          stopRecording();
        }
      };

      socket.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);

          // Handle server-side errors
          if (res.error || res.type === 'Error') {
            console.error('[AssemblyAI] Server streaming error:', res.error || res);
            optionsRef.current.onError?.(`AssemblyAI error: ${res.error || 'Audio streaming error'}`);
            return;
          }

          // AssemblyAI v3 Protocol: { type: "Turn", transcript: "...", end_of_turn: boolean, utterance: "..." }
          if (res.type === 'Turn') {
            const transcript = (res.transcript || res.utterance || '').trim();

            if (res.end_of_turn) {
              if (transcript) {
                accumulatedRef.current = accumulatedRef.current
                  ? `${accumulatedRef.current} ${transcript}`
                  : transcript;
                setFullTranscript(accumulatedRef.current);
                setPartialTranscript('');
                latestPartialRef.current = '';
                optionsRef.current.onTranscriptUpdate?.(accumulatedRef.current, transcript);
              }
            } else {
              setPartialTranscript(transcript);
              latestPartialRef.current = transcript;
              optionsRef.current.onPartialUpdate?.(transcript);
            }
            return;
          }

          // Legacy / Fallback formats (v2 format support)
          const text = res.transcript || res.text || '';
          const isPartial = res.message_type === 'PartialTranscript' || res.end_of_turn === false;
          const isFinal = res.message_type === 'FinalTranscript' || res.end_of_turn === true;

          if (isPartial) {
            setPartialTranscript(text);
            latestPartialRef.current = text;
            optionsRef.current.onPartialUpdate?.(text);
          } else if (isFinal && text.trim()) {
            const finalChunk = text.trim();
            accumulatedRef.current = accumulatedRef.current
              ? `${accumulatedRef.current} ${finalChunk}`
              : finalChunk;
            setFullTranscript(accumulatedRef.current);
            setPartialTranscript('');
            latestPartialRef.current = '';
            optionsRef.current.onTranscriptUpdate?.(accumulatedRef.current, finalChunk);
          }
        } catch {
          // Non-JSON or informational message
        }
      };

      socket.onerror = (err) => {
        console.error('[AssemblyAI] WebSocket error:', err);
        optionsRef.current.onError?.('Streaming audio connection error. Falling back to text input.');
        stopRecording();
      };

      socket.onclose = () => {
        setIsRecording(false);
        setIsConnecting(false);
        setAudioLevel(0);
      };
    } catch (err: unknown) {
      console.error('[AssemblyAI] Failed to start live transcription:', err);
      const errMsg = err instanceof Error ? err.message : 'Microphone or streaming authorization failed.';
      optionsRef.current.onError?.(errMsg);
      stopRecording();
    }
  }, [stopRecording]);

  const resetTranscript = useCallback(() => {
    accumulatedRef.current = '';
    latestPartialRef.current = '';
    setFullTranscript('');
    setPartialTranscript('');
  }, []);

  return {
    isRecording,
    isConnecting,
    partialTranscript,
    fullTranscript,
    audioLevel,
    startRecording,
    stopRecording,
    resetTranscript,
    setFullTranscript,
  };
}
