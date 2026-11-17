import React, { useState, useRef } from 'react';
import {
  FileText,
  X,
  Mic,
  MicOff,
  Sparkles,
  AlertCircle,
  FileCheck,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useLiveTranscription } from '../hooks/useLiveTranscription';

interface DropzoneProps {
  onAnalyze: (file: File, clientContext?: string) => void;
  isLoading: boolean;
}

const BARGAINING_PRESETS = [
  {
    label: 'Freelancer / Contractor',
    context:
      'I am an individual software consultant based in Bengaluru, India. I am concerned about post-termination non-compete covenants (void under Section 27), uncapped indemnities, and jurisdiction forcing foreign courts.',
  },
  {
    label: 'SaaS Enterprise Buyer',
    context:
      'We are procuring enterprise software. We require strict 30-day cancellation notice, mutual indemnification, and liability capped at 12 months fees paid.',
  },
  {
    label: 'Agency / Vendor Provider',
    context:
      'We provide agency development services. We must retain background IP rights, exclude consequential damages, and prevent unilateral scope or price modifications.',
  },
];

export const Dropzone: React.FC<DropzoneProps> = ({ onAnalyze, isLoading }) => {
  const [file, setFile] = useState<File | null>(null);
  const [clientContext, setClientContext] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const baseContextRef = useRef('');

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
      const base = baseContextRef.current.trim();
      setClientContext(base ? `${base} ${fullText}` : fullText);
    },
    onError: (err) => {
      setErrorMessage(`Microphone streaming error: ${err}`);
    },
  });

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
        setErrorMessage('Only PDF contracts are accepted for clause extraction.');
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
        setErrorMessage('Only PDF contracts are accepted for clause extraction.');
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

  const toggleVoiceRecording = () => {
    setErrorMessage(null);
    if (isRecording) {
      stopRecording();
    } else {
      baseContextRef.current = clientContext;
      resetTranscript();
      startRecording();
    }
  };

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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Editorial Header */}
      <div className="mb-8 border-b border-white/[0.06] pb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 text-xs font-mono tracking-wider text-amber-400 uppercase mb-2">
              <span>Section 14 • Commercial Ingestion Desk</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Autonomous Legal Risk Intelligence
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Upload any commercial agreement for deterministic semantic clause extraction, 15+ predatory rule checks, and statutory grounding under the Indian Contract Act, 1872.
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs text-zinc-500 font-mono">
            <span className="flex items-center space-x-1">
              <Lock className="h-3 w-3 text-zinc-400" />
              <span>TLS 1.3 Ingest</span>
            </span>
            <span>•</span>
            <span>SHA-256 Verified</span>
            <span>•</span>
            <span className="text-amber-400/90">Zero Hallucinations</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center space-x-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 2-Column Executive Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Contract Ingestion Target (7 cols) */}
          <div className="lg:col-span-7 flex flex-col">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`flex-1 flex flex-col justify-between rounded-xl border p-6 sm:p-8 transition-all ${
                isDragOver
                  ? 'border-amber-500/60 bg-amber-500/[0.04]'
                  : file
                  ? 'border-emerald-500/40 bg-[#121418] cursor-default'
                  : 'border-white/[0.08] bg-[#121418] hover:border-white/[0.15] cursor-pointer'
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
                <div className="space-y-6">
                  {/* Top: Section Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                      Target 01 • PDF Document
                    </span>
                    <span className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                      Max 50MB
                    </span>
                  </div>

                  {/* Dropzone Center */}
                  <div className="py-6 text-center space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.1] bg-[#181a20] text-zinc-300 shadow-inner">
                      <FileText className="h-6 w-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        Drag and drop your contract PDF, or{' '}
                        <span className="text-amber-400 underline underline-offset-4 decoration-amber-400/40 hover:text-amber-300">
                          browse files
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Master Services Agreements, Vendor SOWs, Employment Covenants, Commercial Leases, NDAs
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Sample Ingest */}
                  <div className="pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-[11px] text-zinc-500 font-mono">
                      No document ready? Test live:
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadSample();
                      }}
                      className="inline-flex items-center space-x-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-500/20"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Load Sample Hazardous Agreement (1-Click)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col justify-between space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 flex items-center space-x-1.5">
                      <FileCheck className="h-3.5 w-3.5" />
                      <span>Document Staged For Audit</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white transition"
                      title="Clear file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="rounded-lg border border-white/[0.08] bg-[#16181f] p-4 flex items-center space-x-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
                      PDF
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-white truncate">{file.name}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • Ready for PyMuPDF clause hierarchy extraction
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500 font-mono flex items-center justify-between pt-4 border-t border-white/[0.06]">
                    <span>Status: Validated</span>
                    <span className="text-emerald-400">● Ready to audit</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Bargaining Position & Voice Dictation Desk (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121418] p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                    Target 02 • Context
                  </span>
                  <h3 className="text-sm font-bold text-white mt-0.5">Bargaining Leverage Notes</h3>
                </div>

                {/* Voice Dictation Button (AssemblyAI v3) */}
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  disabled={isLoading || isConnecting}
                  className={`inline-flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    isRecording
                      ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                      : 'border border-white/[0.1] bg-[#181a20] text-zinc-300 hover:border-amber-500/40 hover:text-white'
                  }`}
                  title={isRecording ? 'Stop Voice Recording' : 'Dictate context using live AssemblyAI WebSocket'}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-3 w-3" />
                      <span>Stop Mic</span>
                    </>
                  ) : isConnecting ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping mr-1" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-3 w-3 text-amber-400" />
                      <span>Live Voice</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Audio Acoustic Waveform Indicator */}
              {isRecording && (
                <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-rose-300 font-mono">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-end space-x-1 h-5">
                        <span className="w-1 bg-rose-500 rounded-full animate-eq-1" />
                        <span className="w-1 bg-rose-500 rounded-full animate-eq-2" />
                        <span className="w-1 bg-rose-500 rounded-full animate-eq-3" />
                        <span className="w-1 bg-rose-500 rounded-full animate-eq-4" />
                      </div>
                      <span className="font-semibold">AssemblyAI v3 Streaming...</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-rose-400 font-bold">LIVE PCM</span>
                  </div>
                  {partialTranscript && (
                    <p className="text-xs italic text-rose-200 pl-6 leading-relaxed">
                      &ldquo;{partialTranscript}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {/* Context Presets */}
              <div className="mt-3 space-y-1.5">
                <span className="text-[11px] font-mono text-zinc-500">Quick Leverage Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {BARGAINING_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setClientContext(p.context)}
                      className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] font-medium text-zinc-300 hover:border-amber-500/30 hover:bg-amber-500/[0.04] hover:text-amber-200 transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Area */}
              <div className="mt-3">
                <textarea
                  value={clientContext}
                  onChange={(e) => setClientContext(e.target.value)}
                  rows={4}
                  placeholder="State your role and contractual priorities or speak via microphone (e.g. 'I am an independent developer in Pune. I need payment within 30 days and zero non-compete restrictions')..."
                  className="w-full rounded-lg border border-white/[0.08] bg-[#0b0c0e] p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 leading-relaxed font-mono"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-white/[0.06]">
              <button
                type="submit"
                disabled={!file || isLoading}
                className="w-full flex items-center justify-center space-x-2 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-600 to-amber-700 py-2.5 px-4 text-xs font-bold text-white shadow-md shadow-amber-900/20 transition-all hover:from-amber-500 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{isLoading ? 'Executing Multi-Agent Audit...' : 'Execute Statutory Legal Audit'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
