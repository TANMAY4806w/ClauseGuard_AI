import React from 'react';
import { AlertCircle, AlertTriangle, Scale, ShieldAlert } from 'lucide-react';

interface RiskGaugeProps {
  score: number;
  breakdown: Record<string, number>;
  totalClauses: number;
  flaggedCount: number;
  contractName: string;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score,
  breakdown,
  totalClauses,
  flaggedCount,
  contractName,
}) => {
  let tierLabel = 'FAVORABLE TERMS';
  let tierColor = 'text-emerald-400';
  let strokeColor = '#10b981';
  let badgeBg = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
  let advisoryText =
    'Standard bilateral commercial terms detected. Low residual liability exposure under the Indian Contract Act, 1872.';

  if (score >= 70) {
    tierLabel = 'CRITICAL EXPOSURE';
    tierColor = 'text-rose-400';
    strokeColor = '#f43f5e';
    badgeBg = 'border-rose-500/30 bg-rose-500/10 text-rose-400';
    advisoryText =
      'Do NOT sign as drafted. High-risk predatory terms detected: unilateral termination, uncapped indemnity, or void non-compete covenants under Section 27 of the Indian Contract Act, 1872.';
  } else if (score >= 45) {
    tierLabel = 'HIGH RISK TIER';
    tierColor = 'text-amber-400';
    strokeColor = '#f59e0b';
    badgeBg = 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    advisoryText =
      'Elevated contractual risk. Mandatory redlines required before signing to protect against unilateral price hikes, foreign jurisdiction, and IP forfeiture.';
  } else if (score >= 20) {
    tierLabel = 'MODERATE EXPOSURE';
    tierColor = 'text-yellow-400';
    strokeColor = '#eab308';
    badgeBg = 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
    advisoryText =
      'Moderate commercial exposure. Certain terms are slanted against your interest. Counter-negotiation term substitutes recommended.';
  }

  // Circular gauge math
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const criticalCount = breakdown['CRITICAL'] || 0;
  const highCount = breakdown['HIGH'] || 0;
  const mediumCount = breakdown['MEDIUM'] || 0;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#121418] p-5 shadow-xl">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5">
        {/* Left: Circular Score Gauge + Title & Legal Advisory */}
        <div className="flex items-center space-x-5">
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="h-28 w-28 transform -rotate-90">
              {/* Background Track */}
              <circle
                cx="56"
                cy="56"
                r={radius}
                stroke="#22242a"
                strokeWidth="7"
                fill="transparent"
              />
              {/* Active Progress */}
              <circle
                cx="56"
                cy="56"
                r={radius}
                stroke={strokeColor}
                strokeWidth="7"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className={`text-2xl font-black tracking-tight font-mono ${tierColor}`}>
                {Math.round(score)}
              </span>
              <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-500">
                SCORE / 100
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider ${badgeBg}`}>
                {tierLabel}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
              {contractName}
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm sm:max-w-md leading-relaxed">
              {advisoryText}
            </p>
          </div>
        </div>

        {/* Right: Telemetry Metrics Matrix */}
        <div className="flex flex-wrap items-center gap-2 self-stretch xl:self-center">
          {/* Critical */}
          <div className="flex-1 sm:flex-none rounded-lg border border-rose-500/20 bg-rose-500/[0.04] px-3 py-2 text-center min-w-[76px]">
            <div className="flex items-center justify-center space-x-1 text-rose-400 mb-0.5">
              <AlertCircle className="h-2.5 w-2.5" />
              <span className="text-[9px] font-mono font-bold uppercase">Critical</span>
            </div>
            <span className="text-base font-bold font-mono text-white">{criticalCount}</span>
          </div>

          {/* High */}
          <div className="flex-1 sm:flex-none rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2 text-center min-w-[76px]">
            <div className="flex items-center justify-center space-x-1 text-amber-400 mb-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              <span className="text-[9px] font-mono font-bold uppercase">High</span>
            </div>
            <span className="text-base font-bold font-mono text-white">{highCount}</span>
          </div>

          {/* Medium */}
          <div className="flex-1 sm:flex-none rounded-lg border border-yellow-500/20 bg-yellow-500/[0.04] px-3 py-2 text-center min-w-[76px]">
            <div className="flex items-center justify-center space-x-1 text-yellow-400 mb-0.5">
              <Scale className="h-2.5 w-2.5" />
              <span className="text-[9px] font-mono font-bold uppercase">Medium</span>
            </div>
            <span className="text-base font-bold font-mono text-white">{mediumCount}</span>
          </div>

          {/* Audit Ratio */}
          <div className="flex-1 sm:flex-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-center min-w-[76px]">
            <div className="flex items-center justify-center space-x-1 text-zinc-400 mb-0.5">
              <ShieldAlert className="h-2.5 w-2.5" />
              <span className="text-[9px] font-mono font-bold uppercase">Hazards</span>
            </div>
            <span className="text-base font-bold font-mono text-amber-300">
              {flaggedCount}/{totalClauses}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
