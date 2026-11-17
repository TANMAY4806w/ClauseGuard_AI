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
  Volume2,
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
      content: `Hello! I am your Legal Counsel Copilot for **${contractName}**. I have reviewed all flagged clauses against the **Indian Contract Act, 1872** and corporate best practices.\n\nAsk me anything: how to push back, what compromise terms to propose, or request a ready-to-send negotiation email.`,
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
      setInputText((prev) => (prev ? `${prev} ${fullText}` : fullText));
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, partialTranscript]);

  // Handle external trigger from RiskCard ("Discuss with Copilot")
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
          content: 'I encountered an error retrieving counsel guidance. Please ensure the backend server is reachable and try again.',
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
    <div className="flex flex-col h-full rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-slate-950/60">
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-white text-sm">Legal Counsel Copilot</h3>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                Active Grounding
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interactive statutory analysis & negotiation script generator
            </p>
          </div>
        </div>

        <Scale className="h-5 w-5 text-indigo-400 hidden sm:block" />
      </div>

      {/* Referenced Sections Header Bar */}
      {referencedSections.length > 0 && (
        <div className="px-5 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center space-x-2 overflow-x-auto text-[11px]">
          <span className="text-slate-500 font-semibold uppercase tracking-wider shrink-0">
            Referenced:
          </span>
          {referencedSections.map((sec, i) => (
            <span
              key={i}
              className="rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-indigo-300 font-mono shrink-0"
            >
              {sec}
            </span>
          ))}
        </div>
      )}

      {/* Chat Messages List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              className={`flex items-start space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mt-1">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Copy button on assistant messages */}
                {!isUser && (
                  <button
                    onClick={() => copyMessage(msg.content, index)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition rounded-md p-1 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                    title="Copy response to clipboard"
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700 mt-1">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming Thinking Indicator */}
        {isSending && (
          <div className="flex items-start space-x-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-none bg-slate-950 border border-slate-800 px-4 py-3 text-xs text-slate-400 flex items-center space-x-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
              <span>Analyzing Indian Contract Act precedent & drafting counsel strategy...</span>
            </div>
          </div>
        )}

        {/* Live Audio Streaming Partial Preview */}
        {isRecording && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 flex items-center space-x-2 text-xs text-rose-300 animate-pulse">
            <Volume2 className="h-4 w-4 text-rose-400 shrink-0" />
            <span className="font-semibold">Transcribing:</span>
            <span className="italic truncate">{partialTranscript || 'Listening to your voice...'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Follow-up Chips */}
      {followups.length > 0 && !isSending && (
        <div className="px-5 py-2.5 bg-slate-950/40 border-t border-slate-800/60 flex items-center space-x-2 overflow-x-auto text-xs">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Quick Ask:</span>
          {followups.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(item)}
              className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] text-slate-300 hover:border-indigo-500/50 hover:bg-slate-850 hover:text-white transition shrink-0"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {/* Input Form with Live Streaming Mic */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-4 border-t border-slate-800 bg-slate-950/80"
      >
        <div className="flex items-center space-x-2">
          {/* Live Mic Button */}
          <button
            type="button"
            onClick={toggleVoiceRecording}
            disabled={isSending || isConnecting}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
              isRecording
                ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
            title={isRecording ? 'Stop Voice Recording' : 'Speak via AssemblyAI Live WebSocket'}
          >
            {isRecording ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Text input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isRecording
                ? 'Transcribing live audio...'
                : 'Ask counsel: "How should I reply to the client?"...'
            }
            disabled={isSending}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Send Message"
          >
            {isSending ? (
              <Sparkles className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
