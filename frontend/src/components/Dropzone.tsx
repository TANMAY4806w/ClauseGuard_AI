import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  X,
  Mic,
  MicOff,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Volume2,
} from 'lucide-react';
import { useLiveTranscription } from '../hooks/useLiveTranscription';

interface DropzoneProps {
  onAnalyze: (file: File, clientContext?: string) => void;
  isLoading: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onAnalyze, isLoading }) => {
  const [file, setFile] = useState<File | null>(null);
  const [clientContext, setClientContext] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      setClientContext((prev) => (prev ? `${prev} ${fullText}` : fullText));
    },
    onError: (err) => {
      setErrorMessage(`Microphone streaming error: ${err}`);
    },
  });

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setErrorMessage(null);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0];
      if (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.pdf')) {
        setFile(droppedFile);
      } else {
        setErrorMessage('Only PDF documents are supported for legal clause auditing.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected.type === 'application/pdf' || selected.name.endsWith('.pdf')) {
        setFile(selected);
      } else {
        setErrorMessage('Only PDF documents are supported for legal clause auditing.');
      }
    }
  };

  // 1-Click Load Sample Hazardous Agreement
  const handleLoadSample = async () => {
    try {
      setErrorMessage(null);
      const res = await fetch('/sample_contract.pdf');
      const blob = await res.blob();
      const sampleFile = new File([blob], 'Master_Services_Agreement_Hazardous_Sample.pdf', {
        type: 'application/pdf',
      });
      setFile(sampleFile);
      setClientContext(
        'I am an individual software consultant based in Bengaluru, India. I am concerned about perpetual unilateral non-compete covenants, uncapped bilateral indemnities, and jurisdiction clauses that force overseas courts.'
      );
    } catch {
      setErrorMessage('Could not load sample PDF. Please choose a local PDF file.');
    }
  };

  // Toggle Voice Input
  const toggleVoiceRecording = () => {
    setErrorMessage(null);
    if (isRecording) {
      stopRecording();
    } else {
      resetTranscript();
      startRecording();
    }
  };

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please select or drop a contract PDF first.');
      return;
    }
    if (isRecording) {
      stopRecording();
    }
    onAnalyze(file, clientContext);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Intro Banner */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center space-x-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 ring-1 ring-inset ring-indigo-500/20 mb-3">
          <ShieldCheck className="h-4 w-4" />
          <span>Autonomous Legal Risk Intelligence & Counsel Copilot</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Upload Contract for Multi-Agent Audit
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
          Flag hidden liabilities, non-compete traps, and one-sided indemnity clauses with physical page citations and statutory grounding under the Indian Contract Act, 1872.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error notification */}
        {errorMessage && (
          <div className="flex items-center space-x-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all cursor-pointer ${
            isDragOver
              ? 'border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
              : file
              ? 'border-emerald-500/50 bg-emerald-500/5 cursor-default'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/80'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,application/pdf"
            className="hidden"
          />

          {!file ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-400 ring-1 ring-indigo-500/20">
                <UploadCloud className="h-8 w-8" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  Drop your legal contract PDF here, or <span className="text-indigo-400 underline underline-offset-2">browse files</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Supports Master Services Agreements, NDAs, Employment Covenants, Vendor Contracts (PDF up to 50MB)
                </p>
              </div>

              {/* Sample Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadSample();
                }}
                className="mt-2 inline-flex items-center space-x-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Load Sample Hazardous Agreement (1-Click Test)</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-slate-950/80 border border-slate-800 p-4">
              <div className="flex items-center space-x-3 text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-medium text-white text-sm sm:text-base">{file.name}</h4>
                  <p className="text-xs text-slate-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Ready for clause extraction
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                title="Remove file"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Client Context with Live AssemblyAI Voice Transcription */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <label htmlFor="context-input" className="text-sm font-semibold text-slate-200">
                Client Context & Bargaining Position (Optional)
              </label>
              <span className="text-[11px] rounded-md bg-slate-800 px-2 py-0.5 text-slate-400">
                Voice or Text
              </span>
            </div>

            {/* Mic Button for Live Streaming Audio */}
            <button
              type="button"
              onClick={toggleVoiceRecording}
              disabled={isLoading || isConnecting}
              className={`inline-flex items-center space-x-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                isRecording
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse'
                  : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff className="h-3.5 w-3.5 text-white" />
                  <span>Stop Recording</span>
                </>
              ) : isConnecting ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping mr-1" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Record Live Voice</span>
                </>
              )}
            </button>
          </div>

          {/* Active Audio Waveform & Partial Realtime Preview */}
          {isRecording && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-2">
              <div className="flex items-center space-x-3">
                <Volume2 className="h-4 w-4 text-rose-400 animate-bounce" />
                <div className="flex items-center space-x-1 h-4">
                  <span className="w-1 bg-rose-500 rounded-full animate-audio-bar-1 h-3" />
                  <span className="w-1 bg-rose-500 rounded-full animate-audio-bar-2 h-4" />
                  <span className="w-1 bg-rose-500 rounded-full animate-audio-bar-3 h-2" />
                  <span className="w-1 bg-rose-500 rounded-full animate-audio-bar-4 h-4" />
                </div>
                <span className="text-xs font-medium text-rose-300">
                  Streaming audio live to AssemblyAI v3 (16kHz PCM)...
                </span>
              </div>
              {partialTranscript && (
                <p className="text-xs italic text-rose-200 pl-7">
                  &ldquo;{partialTranscript}&rdquo;
                </p>
              )}
            </div>
          )}

          <textarea
            id="context-input"
            value={clientContext}
            onChange={(e) => setClientContext(e.target.value)}
            rows={3}
            placeholder="Tell your AI counsel who you are, what terms you cannot accept, or speak via microphone (e.g. 'I am an independent developer. Please check payment frequency and ensure intellectual property doesn't forfeit my prior portfolio')..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!file || isLoading}
            className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-indigo-500/40"
          >
            <ShieldCheck className="h-5 w-5" />
            <span>{isLoading ? 'Auditing Contract...' : 'Run Autonomous Legal Audit'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
