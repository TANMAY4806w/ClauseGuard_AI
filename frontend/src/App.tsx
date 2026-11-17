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
          // Fetch final contract analysis
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
    } catch (err) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      alert('Failed to upload contract. Please ensure backend is running at http://localhost:8000');
    }
  };

  // Reset to Upload another contract
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

  // When user clicks "Discuss with Copilot" on a specific clause card
  const handleAskCopilotAboutClause = (clause: ClauseAuditItem) => {
    const question = `Regarding ${clause.risk_id} (${clause.headline}, ${clause.citation.section}):\nWhy is this considered ${clause.risk_level} risk under Indian law, and how can I negotiate the recommended counter-term with the other party?`;
    setCopilotTriggerMessage(question);
    setMobileTab('copilot');
  };

  // Filter findings
  const filteredFindings = analysis?.findings.filter((item) => {
    if (selectedFilter === 'ALL') return true;
    return item.risk_level === selectedFilter;
  }) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Sticky Navbar */}
      <Navbar
        currentDocName={contractFilename}
        onReset={handleReset}
        isAnalyzing={isUploading}
      />

      <main className="flex-1 w-full">
        {/* Step 1: Upload Dropzone & Voice Context */}
        {!docId && !analysis && (
          <Dropzone onAnalyze={handleAnalyze} isLoading={isUploading} />
        )}

        {/* Step 2: Live Processing Progress Stepper */}
        {isUploading && !analysis && (
          <ProgressStepper status={jobStatus} filename={contractFilename} />
        )}

        {/* Step 3: Executive Legal Risk Intelligence Dashboard */}
        {analysis && (
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
            {/* Top Risk Gauge & Executive Summary */}
            <RiskGauge
              score={analysis.overall_contract_risk_score}
              breakdown={analysis.risk_summary_breakdown}
              totalClauses={analysis.total_clauses_analyzed}
              flaggedCount={analysis.flagged_risks_count}
              contractName={analysis.contract_name}
            />

            {/* Filter Bar & Mobile View Switcher */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-y border-slate-800">
              {/* Severity Filter Tabs */}
              <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
                <span className="flex items-center text-xs font-semibold text-slate-400 mr-1 shrink-0">
                  <Filter className="h-3.5 w-3.5 mr-1 text-slate-500" />
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
                      className={`inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <span>{level}</span>
                      <span className="rounded-full bg-slate-950/60 px-1.5 py-0.2 text-[10px] text-slate-300">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Tab Switcher (Visible only on smaller screens) */}
              <div className="flex sm:hidden w-full rounded-xl bg-slate-900 border border-slate-800 p-1">
                <button
                  onClick={() => setMobileTab('audit')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition ${
                    mobileTab === 'audit'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>Clause Findings ({filteredFindings.length})</span>
                </button>
                <button
                  onClick={() => setMobileTab('copilot')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition ${
                    mobileTab === 'copilot'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
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
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                    <ShieldAlert className="h-4 w-4 text-indigo-400" />
                    <span>Flagged Contract Hazards ({filteredFindings.length})</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    Showing {selectedFilter.toLowerCase()} clauses
                  </span>
                </div>

                {filteredFindings.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400 mb-3" />
                    <h4 className="font-semibold text-white">No clauses in this severity tier</h4>
                    <p className="text-xs text-slate-400 mt-1">
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
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 ClauseGuard AI — Multi-Agent Legal Intelligence Microservice.</p>
          <p className="text-slate-400">
            Compliant with Sections 27, 73, 74 & 124 of the Indian Contract Act, 1872
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
