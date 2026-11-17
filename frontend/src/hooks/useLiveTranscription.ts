import { useState, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';

export interface UseLiveTranscriptionOptions {
  onTranscriptUpdate?: (fullText: string) => void;
  onPartialUpdate?: (partialText: string) => void;
  onError?: (err: string) => void;
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
  const accumulatedRef = useRef<string>('');

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setIsConnecting(false);

    // Stop audio stream and tracks
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
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
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
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
        const audioCtx = new AudioCtx({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        // ScriptProcessor buffer size: 4096 gives ~256ms chunk at 16kHz
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          // Convert 32-bit float PCM [-1.0, 1.0] to 16-bit linear PCM
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // Send raw binary PCM audio buffer over WebSocket
          socketRef.current.send(pcm16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      socket.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);

          // AssemblyAI v3 messages format:
          // Partial transcript
          if (res.message_type === 'PartialTranscript' || res.message_type === 'RealtimeTranscript' && !res.text) {
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
              options.onTranscriptUpdate?.(accumulatedRef.current);
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
