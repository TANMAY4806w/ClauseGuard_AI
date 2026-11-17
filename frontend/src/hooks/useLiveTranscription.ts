import { useState, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';

export interface UseLiveTranscriptionOptions {
  /**
   * Called whenever a finalized chunk arrives.
   * @param fullText The full accumulated text for the current recording session.
   * @param latestChunk The specific final chunk just recognized.
   */
  onTranscriptUpdate?: (fullText: string, latestChunk: string) => void;
  onPartialUpdate?: (partialText: string) => void;
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

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const accumulatedRef = useRef<string>('');

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setIsConnecting(false);

    // Stop audio stream and tracks
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Close WebSocket connection with termination message
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify({ terminate_session: true }));
        } catch {
          // ignore
        }
      }
      socketRef.current.close();
      socketRef.current = null;
    }

    setPartialTranscript('');
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setIsConnecting(true);

      // 1. Fetch short-lived streaming token from backend
      const voiceTokenData = await apiClient.getVoiceToken();
      const wsUrl = `${voiceTokenData.websocket_url}&token=${encodeURIComponent(voiceTokenData.token)}`;

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

      // 3. Initialize WebSocket connection
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnecting(false);
        setIsRecording(true);

        // 4. Setup AudioContext and PCM streaming
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        // ScriptProcessor buffer size: 4096 samples
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        // Mute gain node to prevent audio feedback/echo to user's speakers
        const zeroGain = audioCtx.createGain();
        zeroGain.gain.value = 0;
        gainNodeRef.current = zeroGain;

        processor.onaudioprocess = (e) => {
          if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          // Downsample input audio to standard 16kHz Int16 linear PCM
          const pcm16 = downsampleTo16kHz(inputData, audioCtx.sampleRate);

          // Send raw binary PCM audio buffer over WebSocket
          socketRef.current.send(pcm16.buffer as ArrayBuffer);
        };

        source.connect(processor);
        processor.connect(zeroGain);
        zeroGain.connect(audioCtx.destination);
      };

      socket.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);

          // Handle server-side errors
          if (res.error) {
            console.error('AssemblyAI streaming error:', res.error);
            options.onError?.(`AssemblyAI error: ${res.error}`);
            return;
          }

          // AssemblyAI v3 messages format:
          // Partial transcript
          if (res.message_type === 'PartialTranscript' || (res.message_type === 'RealtimeTranscript' && !res.text)) {
            const text = res.text || '';
            setPartialTranscript(text);
            options.onPartialUpdate?.(text);
          }
          // Final transcript for audio segment
          else if (res.message_type === 'FinalTranscript' || (res.text && res.message_type !== 'PartialTranscript')) {
            const finalChunk = res.text ? res.text.trim() : '';
            if (finalChunk) {
              accumulatedRef.current = accumulatedRef.current
                ? `${accumulatedRef.current} ${finalChunk}`
                : finalChunk;
              setFullTranscript(accumulatedRef.current);
              setPartialTranscript('');
              options.onTranscriptUpdate?.(accumulatedRef.current, finalChunk);
            }
          }
        } catch {
          // Non-JSON or informational message
        }
      };

      socket.onerror = (err) => {
        console.error('AssemblyAI WebSocket error:', err);
        options.onError?.('Streaming audio connection error. Falling back to text input.');
        stopRecording();
      };

      socket.onclose = () => {
        setIsRecording(false);
        setIsConnecting(false);
      };
    } catch (err: unknown) {
      console.error('Failed to start live transcription:', err);
      const errMsg = err instanceof Error ? err.message : 'Microphone or streaming authorization failed.';
      options.onError?.(errMsg);
      stopRecording();
    }
  }, [options, stopRecording]);

  const resetTranscript = useCallback(() => {
    accumulatedRef.current = '';
    setFullTranscript('');
    setPartialTranscript('');
  }, []);

  return {
    isRecording,
    isConnecting,
    partialTranscript,
    fullTranscript,
    startRecording,
    stopRecording,
    resetTranscript,
    setFullTranscript,
  };
}
