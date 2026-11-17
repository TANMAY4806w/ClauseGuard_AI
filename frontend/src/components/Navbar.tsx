import React from 'react';
import { ShieldAlert, FileText, RefreshCw, Sparkles } from 'lucide-react';

interface NavbarProps {
  currentDocName?: string;
  onReset?: () => void;
  isAnalyzing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentDocName, onReset, isAnalyzing }) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Statutory Grounding Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-white text-lg">ClauseGuard AI</span>
              <span className="hidden sm:inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
                <Sparkles className="mr-1 h-3 w-3 text-indigo-400" />
                Legal Intelligence Microservice
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Statutorily grounded under the Indian Contract Act, 1872
            </p>
          </div>
        </div>

        {/* Current Document or Status */}
        <div className="flex items-center space-x-3">
          {currentDocName && (
            <div className="flex items-center space-x-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 max-w-[200px] sm:max-w-xs truncate">
              <FileText className="h-4 w-4 shrink-0 text-indigo-400" />
              <span className="truncate">{currentDocName}</span>
            </div>
          )}

          {currentDocName && onReset && (
            <button
              onClick={onReset}
              disabled={isAnalyzing}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
              title="Upload another contract"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">New Audit</span>
            </button>
          )}

          {/* GitHub link */}
          <a
            href="https://github.com/TANMAY4806w/ClauseGuard_AI"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title="View Source on GitHub"
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
};
