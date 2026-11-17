import React from 'react';
import { CheckCircle2, Clock, Loader2, AlertTriangle, FileSearch, Binary, Scale, ShieldCheck } from 'lucide-react';
import type { JobStatusResponse } from '../types';

interface ProgressStepperProps {
  status: JobStatusResponse | null;
  filename: string;
}

const STAGES = [
  { id: 'PARSING', label: 'Document Parsing', description: 'PyMuPDF physical page layout & section extraction', icon: FileSearch },
  { id: 'EMBEDDING', label: 'Semantic Indexing', description: 'BAAI/bge Legal embeddings & Qdrant vector indexing', icon: Binary },
  { id: 'AUDITING', label: 'Statutory Auditing', description: 'Indian Contract Act 1872 & Multi-Provider LLM reasoning', icon: Scale },
  { id: 'COMPLETED', label: 'Audit Finalized', description: 'Risk intelligence synthesis & Copilot grounding ready', icon: ShieldCheck },
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
        return 2;
      case 'COMPLETED':
        return 3;
      default:
        return 0;
    }
  };

  const activeIndex = getStageIndex(currentStage);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        {/* Title */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              Autonomous Pipeline Active
            </span>
            <h2 className="text-xl font-bold text-white mt-1">Auditing {filename}</h2>
          </div>
          <div className="flex items-center space-x-2 text-indigo-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-semibold">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              isFailed ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Error banner */}
        {isFailed && (
          <div className="mt-6 flex items-center space-x-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold">Pipeline Execution Halted</p>
              <p className="mt-0.5">{status?.error || 'An unexpected error occurred during contract parsing.'}</p>
            </div>
          </div>
        )}

        {/* Vertical / Horizontal Steps */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < activeIndex || currentStage === 'COMPLETED';
            const isCurrent = idx === activeIndex && currentStage !== 'COMPLETED';
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                    : isCompleted
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-slate-800 bg-slate-950/40 opacity-50'
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl mb-2 ${
                    isCurrent
                      ? 'bg-indigo-600 text-white animate-pulse'
                      : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isCurrent ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <h4 className="text-xs font-semibold text-white">{stage.label}</h4>
                <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{stage.description}</p>
              </div>
            );
          })}
        </div>

        {/* Live microservice console status */}
        <div className="mt-6 rounded-xl bg-slate-950 border border-slate-800/80 p-3.5 flex items-center space-x-3 text-xs font-mono text-slate-400">
          <Clock className="h-4 w-4 text-indigo-400 shrink-0" />
          <span className="truncate">
            [worker_node_1] Current operation: {currentStage} • Progress: {progressPercent}% • Qdrant Clause Indexing
          </span>
        </div>
      </div>
    </div>
  );
};
