import { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Dropzone } from './components/Dropzone';
import { ProgressStepper } from './components/ProgressStepper';
import { RiskGauge } from './components/RiskGauge';
import { RiskCard } from './components/RiskCard';
import { LegalCopilot } from './components/LegalCopilot';
import { apiClient } from './api/client';
import type {
  JobStatusResponse,
  ContractAnalysisResponse,
  ClauseAuditItem,
  RiskLevel,
} from './types';
import { ShieldAlert, MessageSquare, Filter, Layers, CheckCircle2 } from 'lucide-react';

export function App() {
  const [docId, setDocId] = useState<string | null>(null);
  const [contractFilename, setContractFilename] = useState<string>('');
  const [clientContext, setClientContext] = useState<string>('');
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [analysis, setAnalysis] = useState<ContractAnalysisResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [mobileTab, setMobileTab] = useState<'audit' | 'copilot'>('audit');
  const [copilotTriggerMessage, setCopilotTriggerMessage] = useState<string | null>(null);

  const pollingIntervalRef = useRef<number | null>(null);

  // Polling contract processing status
  useEffect(() => {
    if (!docId || analysis || !isUploading) return;

    const pollStatus = async () => {
      try {
        const status = await apiClient.getStatus(docId);
        setJobStatus(status);

        if (status.is_completed) {
          if (pollingIntervalRef.current) {
            window.clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          const report = await apiClient.getAnalysis(docId);
          setAnalysis(report);
          setIsUploading(false);
        } else if (status.current_stage === 'FAILED') {
          if (pollingIntervalRef.current) {
            window.clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setIsUploading(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    pollStatus();
    pollingIntervalRef.current = window.setInterval(pollStatus, 1500);

    return () => {
      if (pollingIntervalRef.current) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [docId, analysis, isUploading]);

  // Handle Contract Upload
  const handleAnalyze = async (file: File, context?: string) => {
    try {
      setIsUploading(true);
      setContractFilename(file.name);
      setClientContext(context || '');
      setAnalysis(null);
      setJobStatus(null);

      const uploadRes = await apiClient.uploadContract(file, context);
      setDocId(uploadRes.doc_id);

      // Instant cache return
      if (uploadRes.status === 'COMPLETED') {
        const report = await apiClient.getAnalysis(uploadRes.doc_id);
        setAnalysis(report);
        setIsUploading(false);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      alert('Failed to upload contract. Please ensure backend is running at http://localhost:8000');
    }
  };

  const handleReset = () => {
    if (pollingIntervalRef.current) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setDocId(null);
    setContractFilename('');
    setClientContext('');
    setJobStatus(null);
    setAnalysis(null);
    setIsUploading(false);
    setSelectedFilter('ALL');
    setCopilotTriggerMessage(null);
  };

  const handleAskCopilotAboutClause = (clause: ClauseAuditItem) => {
    const question = `Regarding ${clause.risk_id} (${clause.headline}, ${clause.citation.section}):\nWhy is this considered ${clause.risk_level} risk under Indian law, and how can I negotiate the recommended counter-term with the other party?`;
    setCopilotTriggerMessage(question);
    setMobileTab('copilot');
  };

  const filteredFindings =
    analysis?.findings.filter((item) => {
      if (selectedFilter === 'ALL') return true;
      return item.risk_level === selectedFilter;
    }) || [];

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-[#f4f4f5] flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200">
      {/* Sticky Workspace Header */}
      <Navbar
        currentDocName={contractFilename}
        onReset={handleReset}
        isAnalyzing={isUploading}
      />

      <main className="flex-1 w-full">
        {/* Step 1: Upload Ingestion Desk */}
        {!docId && !analysis && (
          <Dropzone onAnalyze={handleAnalyze} isLoading={isUploading} />
        )}

        {/* Step 2: Processing Progress Stepper */}
        {isUploading && !analysis && (
          <ProgressStepper status={jobStatus} filename={contractFilename} />
        )}

        {/* Step 3: Executive Legal Risk Intelligence Dashboard */}
        {analysis && (
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
            {/* Top Risk Gauge & Summary */}
            <RiskGauge
              score={analysis.overall_contract_risk_score}
              breakdown={analysis.risk_summary_breakdown}
              totalClauses={analysis.total_clauses_analyzed}
              flaggedCount={analysis.flagged_risks_count}
              contractName={analysis.contract_name}
            />

            {/* Filter Bar & Mobile View Switcher */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-y border-white/[0.06]">
              {/* Severity Filter Tabs */}
              <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
                <span className="flex items-center text-xs font-mono font-semibold text-zinc-500 mr-1 shrink-0 uppercase tracking-wider">
                  <Filter className="h-3 w-3 mr-1 text-zinc-500" />
                  Severity:
                </span>
                {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'SAFE'] as const).map((level) => {
                  const count =
                    level === 'ALL'
                      ? analysis.flagged_risks_count
                      : analysis.risk_summary_breakdown[level] || 0;
                  const isActive = selectedFilter === level;
                  return (
                    <button
                      key={level}
                      onClick={() => setSelectedFilter(level)}
                      className={`inline-flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition shrink-0 ${
                        isActive
                          ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : 'border border-white/[0.06] bg-[#121418] text-zinc-400 hover:text-white hover:border-white/[0.12]'
                      }`}
                    >
                      <span>{level}</span>
                      <span className="rounded bg-black/40 px-1.5 py-0.2 text-[10px] text-zinc-300">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Tab Switcher */}
              <div className="flex sm:hidden w-full rounded-lg bg-[#121418] border border-white/[0.06] p-1 font-mono">
                <button
                  onClick={() => setMobileTab('audit')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded text-xs font-semibold transition ${
                    mobileTab === 'audit'
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Findings ({filteredFindings.length})</span>
                </button>
                <button
                  onClick={() => setMobileTab('copilot')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded text-xs font-semibold transition ${
                    mobileTab === 'copilot'
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Counsel Copilot</span>
                </button>
              </div>
            </div>

            {/* Main Interactive Split-View (Desktop) / Tabbed (Mobile) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Clause Audit Findings List (60% on desktop) */}
              <div
                className={`lg:col-span-7 space-y-4 ${
                  mobileTab === 'copilot' ? 'hidden sm:block' : 'block'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center space-x-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                    <span>Contract Audit Dossier ({filteredFindings.length})</span>
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-600">
                    Filter: {selectedFilter}
                  </span>
                </div>

                {filteredFindings.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.08] bg-[#121418] p-12 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
                    <h4 className="font-semibold text-white text-sm">No clauses in this severity tier</h4>
                    <p className="text-xs text-zinc-400 mt-1 font-mono">
                      No contractual risks matched the active filter. Select &apos;ALL&apos; to view all audited terms.
                    </p>
                  </div>
                ) : (
                  filteredFindings.map((item) => (
                    <RiskCard
                      key={item.risk_id}
                      item={item}
                      onAskCopilot={handleAskCopilotAboutClause}
                    />
                  ))
                )}
              </div>

              {/* Right Column: Sticky Legal Counsel Copilot (40% on desktop) */}
              <div
                className={`lg:col-span-5 lg:sticky lg:top-20 h-[680px] ${
                  mobileTab === 'audit' ? 'hidden sm:block' : 'block'
                }`}
              >
                <LegalCopilot
                  docId={docId || analysis.doc_id}
                  contractName={analysis.contract_name}
                  initialContext={clientContext}
                  externalTriggerMessage={copilotTriggerMessage}
                  onClearTrigger={() => setCopilotTriggerMessage(null)}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/[0.06] bg-[#0b0c0e] py-5 text-center text-xs text-zinc-500 font-mono">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p>© 2026 ClauseGuard AI — Enterprise Legal Intelligence Microservice.</p>
          <p className="text-zinc-400 text-[11px]">
            Statutorily grounded under Sections 27, 73, 74 & 124 of the Indian Contract Act, 1872
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
