import React from 'react';
import { AlertCircle, AlertTriangle, Scale, FileText } from 'lucide-react';

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
  // Determine risk grade and color scheme
  let tierLabel = 'FAVORABLE';
  let tierColor = 'text-emerald-400';
  let strokeColor = '#10b981';
  let badgeBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  let advisoryText = 'This agreement contains low residual exposure. Standard contractual protections apply.';

  if (score >= 70) {
    tierLabel = 'CRITICAL HAZARD';
    tierColor = 'text-rose-400';
    strokeColor = '#f43f5e';
    badgeBg = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    advisoryText = 'Do NOT sign as drafted. Significant legal traps detected: uncapped liability, one-sided indemnity, or void non-compete clauses under Indian Law.';
  } else if (score >= 45) {
    tierLabel = 'HIGH RISK';
    tierColor = 'text-amber-400';
    strokeColor = '#f59e0b';
    badgeBg = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    advisoryText = 'Elevated contractual risk. Mandatory redlines required before execution to protect against unilateral termination or severe IP forfeiture.';
  } else if (score >= 20) {
    tierLabel = 'MODERATE EXPOSURE';
    tierColor = 'text-yellow-400';
    strokeColor = '#eab308';
    badgeBg = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    advisoryText = 'Moderate exposure. Some standard terms are slanted against your interest. Counter-terms recommended.';
  }

  // Circular gauge calculation
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const criticalCount = breakdown['CRITICAL'] || 0;
  const highCount = breakdown['HIGH'] || 0;
  const mediumCount = breakdown['MEDIUM'] || 0;
  const lowCount = (breakdown['LOW'] || 0) + (breakdown['SAFE'] || 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Left: SVG Circular Risk Gauge */}
        <div className="flex items-center space-x-6">
          <div className="relative flex items-center justify-center">
            <svg className="h-36 w-36 transform -rotate-90">
              {/* Background track circle */}
              <circle
                cx="72"
                cy="72"
                r={radius}
                stroke="#1e293b"
                strokeWidth="10"
                fill="transparent"
              />
              {/* Animated Progress circle */}
              <circle
                cx="72"
                cy="72"
                r={radius}
                stroke={strokeColor}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className={`text-3xl font-black tracking-tight ${tierColor}`}>
                {Math.round(score)}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                Risk Score
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${badgeBg}`}>
                {tierLabel}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white truncate max-w-xs sm:max-w-md">
              {contractName}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm sm:max-w-md leading-relaxed">
              {advisoryText}
            </p>
          </div>
        </div>

        {/* Right: Risk Level Breakdown Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
          {/* Critical */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center min-w-[90px]">
            <div className="flex items-center justify-center space-x-1 text-rose-400 mb-1">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Critical</span>
            </div>
            <span className="text-xl font-bold text-white">{criticalCount}</span>
          </div>

          {/* High */}
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 text-center min-w-[90px]">
            <div className="flex items-center justify-center space-x-1 text-orange-400 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">High</span>
            </div>
            <span className="text-xl font-bold text-white">{highCount}</span>
          </div>

          {/* Medium */}
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-center min-w-[90px]">
            <div className="flex items-center justify-center space-x-1 text-yellow-400 mb-1">
              <Scale className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Medium</span>
            </div>
            <span className="text-xl font-bold text-white">{mediumCount}</span>
          </div>

          {/* Safe / Low */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center min-w-[90px]">
            <div className="flex items-center justify-center space-x-1 text-emerald-400 mb-1">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Low/Safe</span>
            </div>
            <span className="text-xl font-bold text-white">{lowCount}</span>
          </div>

          {/* Total Audited */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-center min-w-[90px]">
            <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Flagged/Total</span>
            </div>
            <span className="text-xl font-bold text-slate-200">{flaggedCount}/{totalClauses}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
