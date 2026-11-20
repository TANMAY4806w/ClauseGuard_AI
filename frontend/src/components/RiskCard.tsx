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
  Shield,
  FileCheck2,
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
          bg: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
          icon: <AlertCircle className="h-3 w-3 mr-1" />,
        };
      case 'HIGH':
        return {
          bg: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
          icon: <AlertTriangle className="h-3 w-3 mr-1" />,
        };
      case 'MEDIUM':
        return {
          bg: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
          icon: <Scale className="h-3 w-3 mr-1" />,
        };
      default:
        return {
          bg: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
          icon: <Shield className="h-3 w-3 mr-1" />,
        };
    }
  };

  const badge = getRiskBadge(item.risk_level);

  // Normalize section text to authoritative 'Sec X.X' format (eliminating symbol glyph ligatures & glitches)
  const cleanSection = (() => {
    const raw = item.citation.section || '';
    let cleaned = raw.replace(/^[§\u00A7\s]+/, '').replace(/^99\s*/, '').trim();
    if (!cleaned) return 'Sec 1.0';
    if (!cleaned.toLowerCase().startsWith('sec')) {
      return `Sec ${cleaned}`;
    }
    return cleaned;
  })();

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
    <div className="rounded-xl border border-white/[0.08] bg-[#121418] p-5 transition-all hover:border-white/[0.15] shadow-sm">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider ${badge.bg}`}>
            {badge.icon}
            {item.risk_level}
          </span>
          <span className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] font-mono font-medium text-zinc-300">
            {item.clause_category}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">{item.risk_id}</span>
        </div>

        {/* Verifiable Physical Citation */}
        <div className="flex items-center space-x-1.5 text-xs text-zinc-400 font-mono">
          <Quote className="h-3 w-3 text-amber-400 shrink-0" />
          <span className="text-zinc-200 font-semibold">{cleanSection}</span>
          <span className="text-zinc-600">•</span>
          <span className="text-amber-300/80">Page {item.citation.page}</span>
        </div>
      </div>

      {/* Headline & Danger Summary */}
      <div className="mt-3">
        <h4 className="text-sm font-bold text-white tracking-tight">{item.headline}</h4>
        <p className="mt-1.5 text-xs sm:text-[13px] text-zinc-300 leading-relaxed font-sans">
          {item.danger_summary}
        </p>
      </div>

      {/* Statutory Grounding Callout (Indian Contract Act, 1872) */}
      {item.statutory_compliance_note && (
        <div className="mt-3.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3 flex items-start space-x-2.5 text-xs text-amber-200/90 font-mono">
          <BookOpen className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-amber-300 uppercase tracking-wider text-[10px] block mb-1">
              Statutory Precedent • Indian Contract Act, 1872
            </span>
            <span className="text-zinc-200 leading-normal">{item.statutory_compliance_note}</span>
          </div>
        </div>
      )}

      {/* Expandable Section: Verbatim Excerpt & Counter-Proposal */}
      {isExpanded && (
        <div className="mt-3.5 space-y-3 pt-3 border-t border-white/[0.06]">
          {/* Verbatim Excerpt from PDF */}
          <div className="rounded-lg border border-white/[0.06] bg-[#090a0d] p-3 text-xs">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block mb-1">
              Verbatim Text from Document (Page {item.citation.page})
            </span>
            <p className="text-zinc-300 italic font-mono leading-relaxed bg-black/30 p-2 rounded border border-white/[0.04]">
              &ldquo;{item.citation.verbatim_text}&rdquo;
            </p>
          </div>

          {/* Recommended Counter-Term */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center space-x-1">
                <FileCheck2 className="h-3 w-3" />
                <span>Recommended Counter-Proposal (Balanced Term)</span>
              </span>
            </div>
            <p className="text-zinc-200 font-mono leading-relaxed bg-black/40 p-2.5 rounded border border-emerald-500/20">
              {item.recommended_counter_term}
            </p>
          </div>
        </div>
      )}

      {/* Action Controls */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center space-x-1 text-xs font-mono font-semibold text-amber-400 hover:text-amber-300 transition"
        >
          <span>{isExpanded ? 'Hide Citation & Redline' : 'Inspect Verbatim Excerpt & Counter-Term'}</span>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <div className="flex items-center space-x-2">
          {onAskCopilot && (
            <button
              onClick={() => onAskCopilot(item)}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-white/[0.08] bg-[#181a20] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-amber-500/40 hover:text-white transition"
            >
              <MessageSquare className="h-3 w-3 text-amber-400" />
              <span>Discuss with Copilot</span>
            </button>
          )}

          <button
            onClick={handleCopyRedline}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition font-mono"
            title="Copy recommended counter-term to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy Redline</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
