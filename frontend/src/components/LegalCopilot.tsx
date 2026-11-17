import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Sparkles,
  Copy,
  Check,
  Scale,
} from 'lucide-react';
import { useLiveTranscription } from '../hooks/useLiveTranscription';
import { apiClient } from '../api/client';
import type { ChatMessage, ContractChatResponse } from '../types';

interface LegalCopilotProps {
  docId: string;
  contractName: string;
  initialContext?: string;
  externalTriggerMessage?: string | null;
  onClearTrigger?: () => void;
}

export const LegalCopilot: React.FC<LegalCopilotProps> = ({
  docId,
  contractName,
  initialContext,
  externalTriggerMessage,
  onClearTrigger,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello. I am your Legal Counsel Copilot for **${contractName}**. I have reviewed all extracted clauses against the **Indian Contract Act, 1872** and corporate risk standards.\n\nYou can ask me: how to negotiate high-risk terms, compromise language, or request a ready-to-send pushback email.`,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [followups, setFollowups] = useState<string[]>([
    'Draft a polite pushback email for the client',
    'Is the non-compete enforceable under Section 27?',
    'What compromise can I propose for uncapped indemnity?',
  ]);
  const [referencedSections, setReferencedSections] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const baseInputRef = useRef('');

  // Live WebSocket Audio Transcription Hook
  const {
    isRecording,
    isConnecting,
    partialTranscript,
    startRecording,
    stopRecording,
    resetTranscript,
  } = useLiveTranscription({
    onTranscriptUpdate: (fullText) => {
      const base = baseInputRef.current.trim();
      setInputText(base ? `${base} ${fullText}` : fullText);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, partialTranscript]);

  useEffect(() => {
    if (externalTriggerMessage) {
      handleSendMessage(externalTriggerMessage);
      onClearTrigger?.();
    }
  }, [externalTriggerMessage]);

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt || isSending) return;

    if (isRecording) {
      stopRecording();
    }

    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: prompt }];
    setMessages(newHistory);
    setInputText('');
    resetTranscript();
    setIsSending(true);

    try {
      const response: ContractChatResponse = await apiClient.counselChat(docId, {
        message: prompt,
        history: newHistory.slice(-6),
        client_context: initialContext,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: response.reply }]);
      if (response.suggested_followups && response.suggested_followups.length > 0) {
        setFollowups(response.suggested_followups);
      }
      if (response.referenced_sections && response.referenced_sections.length > 0) {
        setReferencedSections(response.referenced_sections);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'I encountered an error retrieving counsel guidance. Please ensure the backend microservice is operational.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const toggleVoiceRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      baseInputRef.current = inputText;
      resetTranscript();
      startRecording();
    }
  };

  const copyMessage = async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-white/[0.08] bg-[#121418] shadow-xl overflow-hidden">
      {/* Console Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 bg-[#0e1014]">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Scale className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-white text-xs sm:text-sm">Corporate Counsel Console</h3>
              <span className="inline-flex items-center space-x-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400 font-semibold">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                <span>GROUNDED</span>
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">
              Indian Contract Act, 1872 • Strategic Redlines
            </p>
          </div>
        </div>
      </div>

      {/* Referenced Sections Header Bar */}
      {referencedSections.length > 0 && (
        <div className="px-5 py-2 bg-[#0b0c0e] border-b border-white/[0.04] flex items-center space-x-2 overflow-x-auto text-[10px] font-mono">
          <span className="text-zinc-500 uppercase tracking-wider shrink-0 font-bold">
            Referenced Clauses:
          </span>
          {referencedSections.map((sec, i) => (
            <span
              key={i}
              className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-300 shrink-0 font-medium"
            >
              {sec}
            </span>
          ))}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              className={`flex items-start space-x-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 mt-1">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`group relative max-w-[88%] rounded-xl px-4 py-3 text-xs sm:text-[13px] leading-relaxed ${
                  isUser
                    ? 'bg-[#1e2029] border border-white/[0.1] text-zinc-100 rounded-tr-none'
                    : 'bg-[#0b0c0e] border border-white/[0.06] text-zinc-200 rounded-tl-none font-mono'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Copy Button */}
                {!isUser && (
                  <button
                    onClick={() => copyMessage(msg.content, index)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition rounded p-1 bg-zinc-800/80 text-zinc-400 hover:text-white"
                    title="Copy advice / email draft to clipboard"
                  >
                    {copiedIndex === index ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>

              {isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-[#1a1c23] text-zinc-400 mt-1">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {/* AI Generating Indicator */}
        {isSending && (
          <div className="flex items-start space-x-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-xl rounded-tl-none bg-[#0b0c0e] border border-white/[0.06] px-4 py-2.5 text-xs text-zinc-400 flex items-center space-x-2 font-mono">
              <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-spin" />
              <span>Synthesizing Indian statutory precedents & drafting strategy...</span>
            </div>
          </div>
        )}

        {/* Live Audio Transcription Streamer Banner */}
        {isRecording && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-2.5 flex items-center space-x-2.5 text-xs text-rose-300 font-mono">
            <div className="flex items-end space-x-1 h-3.5">
              <span className="w-1 bg-rose-500 rounded-full animate-eq-1" />
              <span className="w-1 bg-rose-500 rounded-full animate-eq-2" />
              <span className="w-1 bg-rose-500 rounded-full animate-eq-3" />
            </div>
            <span className="font-bold uppercase text-[10px]">Streaming:</span>
            <span className="italic truncate">{partialTranscript || 'Listening to microphone...'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Follow-up Chips */}
      {followups.length > 0 && !isSending && (
        <div className="px-5 py-2.5 bg-[#0e1014] border-t border-white/[0.04] flex items-center space-x-1.5 overflow-x-auto text-[11px] font-mono">
          <span className="text-zinc-500 uppercase tracking-widest text-[9px] font-bold shrink-0">
            Suggested:
          </span>
          {followups.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(item)}
              className="rounded border border-white/[0.08] bg-[#14161d] px-2.5 py-1 text-zinc-300 hover:border-amber-500/40 hover:text-amber-200 transition shrink-0"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3.5 border-t border-white/[0.06] bg-[#0e1014]"
      >
        <div className="flex items-center space-x-2">
          {/* Live Mic Button */}
          <button
            type="button"
            onClick={toggleVoiceRecording}
            disabled={isSending || isConnecting}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
              isRecording
                ? 'border-rose-500 bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                : 'border-white/[0.08] bg-[#14161d] text-zinc-400 hover:border-amber-500/40 hover:text-white'
            }`}
            title={isRecording ? 'Stop Voice Recording' : 'Speak via AssemblyAI v3 WebSocket'}
          >
            {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5 text-amber-400" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isRecording
                ? 'Transcribing live voice...'
                : 'Ask counsel: "How should I push back on Section 14?"...'
            }
            disabled={isSending}
            className="flex-1 rounded-lg border border-white/[0.08] bg-[#0b0c0e] px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 font-mono"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-600 text-white shadow-sm transition hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send Consultation Message"
          >
            {isSending ? (
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
