import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Scale,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BookOpen,
  Quote,
} from 'lucide-react';
import type { ClauseAuditItem, RiskLevel } from '../types';

interface RiskCardProps {
  item: ClauseAuditItem;
  onAskCopilot?: (clause: ClauseAuditItem) => void;
}

export const RiskCard: React.FC<RiskCardProps> = ({ item, onAskCopilot }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case 'CRITICAL':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          icon: <AlertCircle className="h-3.5 w-3.5 mr-1" />,
        };
      case 'HIGH':
        return {
          bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
          icon: <AlertTriangle className="h-3.5 w-3.5 mr-1" />,
        };
      case 'MEDIUM':
        return {
          bg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
          icon: <Scale className="h-3.5 w-3.5 mr-1" />,
        };
      default:
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: <Scale className="h-3.5 w-3.5 mr-1" />,
        };
    }
  };

  const badge = getRiskBadge(item.risk_level);

  const handleCopyRedline = async () => {
    try {
      await navigator.clipboard.writeText(item.recommended_counter_term);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 transition-all hover:border-slate-700/80 shadow-md">
      {/* Header: Badge, Category, Risk ID */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${badge.bg}`}>
            {badge.icon}
            {item.risk_level}
          </span>
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
            {item.clause_category}
          </span>
          <span className="text-xs text-slate-500 font-mono">{item.risk_id}</span>
        </div>

        {/* Physical Citation Tag */}
        <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
          <Quote className="h-3.5 w-3.5 text-indigo-400" />
          <span>{item.citation.section}</span>
          <span className="text-slate-600">•</span>
          <span>Page {item.citation.page}</span>
        </div>
      </div>

      {/* Headline & Danger Summary */}
      <div className="mt-3">
        <h4 className="text-base font-bold text-white tracking-tight">{item.headline}</h4>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {item.danger_summary}
        </p>
      </div>

      {/* Statutory Grounding Note (Indian Contract Act 1872) */}
      {item.statutory_compliance_note && (
        <div className="mt-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-start space-x-2 text-xs text-indigo-300">
          <BookOpen className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-indigo-200">Statutory Precedent: </span>
            <span>{item.statutory_compliance_note}</span>
          </div>
        </div>
      )}

      {/* Expandable Section: Verbatim Quote & Counter-Term Redline */}
      <div className="mt-4 pt-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
          >
            <span>{isExpanded ? 'Hide Citation & Redline' : 'Inspect Verbatim Quote & Redline'}</span>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          <div className="flex items-center space-x-2">
            {onAskCopilot && (
              <button
                onClick={() => onAskCopilot(item)}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
              >
                <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                <span>Discuss with Copilot</span>
              </button>
            )}
            <button
              onClick={handleCopyRedline}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition"
              title="Copy recommended counter-term to clipboard"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Redline</span>
                </>
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-3">
            {/* Verbatim quote from PDF */}
            <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 text-xs">
              <span className="font-semibold text-slate-400 block mb-1">
                Verbatim Excerpt ({item.citation.section}, Page {item.citation.page}):
              </span>
              <p className="font-mono text-slate-300 italic whitespace-pre-wrap leading-relaxed">
                &ldquo;{item.citation.verbatim_text}&rdquo;
              </p>
            </div>

            {/* Recommended Counter-term */}
            <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-3 text-xs">
              <span className="font-semibold text-emerald-400 block mb-1">
                Recommended Substitute Language (Copy-Paste Redline):
              </span>
              <p className="font-mono text-emerald-200 whitespace-pre-wrap leading-relaxed">
                {item.recommended_counter_term}
              </p>
            </div>

            {/* Strategic Advice */}
            {item.negotiation_advice && (
              <div className="text-xs text-slate-400 italic">
                <span className="font-semibold text-slate-300">Negotiation Strategy: </span>
                {item.negotiation_advice}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
