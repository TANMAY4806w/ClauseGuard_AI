import React from 'react';
import { CheckCircle2, Clock, Loader2, AlertTriangle, FileSearch, Binary, Scale, ShieldCheck } from 'lucide-react';
import type { JobStatusResponse } from '../types';

interface ProgressStepperProps {
  status: JobStatusResponse | null;
  filename: string;
}

const STAGES = [
  { id: 'PARSING', label: 'Document Ingestion', description: 'PyMuPDF physical page layout & section hierarchy', icon: FileSearch },
  { id: 'EMBEDDING', label: 'Semantic Indexing', description: 'BAAI/bge-small dense & BM25 sparse hybrid vectors in Qdrant', icon: Binary },
  { id: 'AUDITING', label: 'Statutory Auditing', description: 'Indian Contract Act 1872 & 15+ predatory rulebase evaluation', icon: Scale },
  { id: 'COMPLETED', label: 'Audit Finalized', description: 'Verbatim citations cross-checked via Levenshtein reflection', icon: ShieldCheck },
];

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ status, filename }) => {
  const currentStage = status?.current_stage || 'PARSING';
  const progressPercent = status?.progress_percent || 15;
  const isFailed = currentStage === 'FAILED' || !!status?.error;

  const getStageIndex = (stage: string) => {
    switch (stage) {
      case 'PARSING':
        return 0;
      case 'EMBEDDING':
        return 1;
      case 'AUDITING':
      case 'AUDITING_PREDATORY_TERMS':
        return 2;
      case 'COMPLETED':
        return 3;
      default:
        return 0;
    }
  };

  const activeIndex = getStageIndex(currentStage);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="rounded-xl border border-white/[0.08] bg-[#121418] p-8 shadow-2xl">
        {/* Title */}
        <div className="flex items-center justify-between pb-6 border-b border-white/[0.06]">
          <div>
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">
              Autonomous Pipeline Active
            </span>
            <h2 className="text-xl font-bold text-white mt-1">Auditing {filename}</h2>
          </div>
          <div className="flex items-center space-x-2 text-amber-400 font-mono text-sm font-bold">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{progressPercent}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              isFailed ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-500 to-emerald-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Error banner */}
        {isFailed && (
          <div className="mt-6 flex items-center space-x-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold">Pipeline Execution Halted</p>
              <p className="mt-0.5">{status?.error || 'An unexpected error occurred during contract parsing.'}</p>
            </div>
          </div>
        )}

        {/* Stage Grid */}
        <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-4">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < activeIndex || currentStage === 'COMPLETED';
            const isCurrent = idx === activeIndex && currentStage !== 'COMPLETED';
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className={`flex flex-col items-center text-center p-3.5 rounded-lg border transition-all ${
                  isCurrent
                    ? 'border-amber-500/50 bg-amber-500/[0.04]'
                    : isCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
                    : 'border-white/[0.04] bg-[#0e1014] opacity-40'
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg mb-2 ${
                    isCurrent
                      ? 'border border-amber-500/40 bg-amber-500/20 text-amber-400 animate-pulse'
                      : isCompleted
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border border-white/[0.06] bg-zinc-900 text-zinc-600'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <h4 className="text-xs font-bold text-white">{stage.label}</h4>
                <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                  {stage.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Worker Telemetry */}
        <div className="mt-6 rounded-lg bg-[#0b0c0e] border border-white/[0.06] p-3 flex items-center space-x-2.5 text-xs font-mono text-zinc-400">
          <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="truncate">
            [worker_node_1] Operation: {currentStage} • Progress: {progressPercent}% • Qdrant Vector Indexing
          </span>
        </div>
      </div>
    </div>
  );
};
