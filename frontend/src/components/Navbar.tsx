import React from 'react';
import { Shield, RefreshCw, FileText, Scale } from 'lucide-react';

interface NavbarProps {
  currentDocName?: string;
  onReset?: () => void;
  isAnalyzing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentDocName, onReset, isAnalyzing }) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.07] bg-[#0b0c0e]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Monogram & Environment Tag */}
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-sm shadow-amber-500/10">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold tracking-tight text-zinc-100 text-sm">ClauseGuard</span>
            <span className="text-zinc-600 font-mono text-xs">/</span>
            <span className="text-xs text-zinc-400 font-medium">Enterprise Legal Intelligence</span>
          </div>
          <div className="hidden md:flex items-center space-x-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-0.5 text-[11px] text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <Scale className="h-3 w-3 text-amber-400/80 mr-0.5" />
            <span>Indian Contract Act, 1872</span>
          </div>
        </div>

        {/* Center: Active Document Status */}
        {currentDocName && (
          <div className="hidden lg:flex items-center space-x-2 rounded-lg border border-white/[0.08] bg-[#14151a] px-3 py-1 text-xs text-zinc-300 max-w-xs truncate">
            <FileText className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span className="truncate font-mono text-[11px]">{currentDocName}</span>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center space-x-2.5">
          {currentDocName && onReset && (
            <button
              onClick={onReset}
              disabled={isAnalyzing}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-white/[0.1] bg-[#181a20] px-3 py-1 text-xs font-medium text-zinc-300 transition-all hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>New Contract</span>
              <kbd className="hidden sm:inline-block rounded border border-zinc-700 bg-zinc-900 px-1 py-0.2 text-[9px] font-mono text-zinc-500">
                Alt+N
              </kbd>
            </button>
          )}

          {/* GitHub Link */}
          <a
            href="https://github.com/TANMAY4806w/ClauseGuard_AI"
            target="_blank"
            rel="noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-[#14151a] text-zinc-400 transition hover:border-white/[0.15] hover:text-white"
            title="Inspect Source Code on GitHub"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
};
