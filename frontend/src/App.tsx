import { useState, useEffect, useRef } from 'react';
import { ContractVaultSidebar } from './components/ContractVaultSidebar';
import { Dropzone } from './components/Dropzone';
import { ProgressStepper } from './components/ProgressStepper';
import { RiskGauge } from './components/RiskGauge';
import { RiskCard } from './components/RiskCard';
import { LegalCopilot } from './components/LegalCopilot';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './context/AuthContext';
import { apiClient } from './api/client';
import type {
  JobStatusResponse,
  ContractAnalysisResponse,
  ClauseAuditItem,
  RiskLevel,
  ContractListItem,
} from './types';
import {
  ShieldAlert,
  MessageSquare,
  Filter,
  CheckCircle2,
  FileText,
  Download,
  Sparkles,
} from 'lucide-react';

export function App() {
  const { user } = useAuth();
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [contractFilename, setContractFilename] = useState<string>('');
  const [clientContext, setClientContext] = useState<string>('');
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [analysis, setAnalysis] = useState<ContractAnalysisResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [copilotTriggerMessage, setCopilotTriggerMessage] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [vaultRefreshTrigger, setVaultRefreshTrigger] = useState(0);
  const [sessionContracts, setSessionContracts] = useState<ContractListItem[]>(() => {
    try {
      const saved = localStorage.getItem('clauseguard_guest_contracts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addSessionContract = (report: ContractAnalysisResponse, fileSize = 0) => {
    setSessionContracts((prev) => {
      const existingIdx = prev.findIndex((c) => c.id === report.doc_id);
      const updatedItem: ContractListItem = {
        id: report.doc_id,
        filename: report.contract_name,
        file_size: fileSize,
        status: 'COMPLETED',
        risk_score: report.overall_contract_risk_score,
        created_at: report.audit_timestamp || new Date().toISOString(),
      };
      const updated = existingIdx >= 0
        ? prev.map((item, idx) => (idx === existingIdx ? updatedItem : item))
        : [updatedItem, ...prev];
      try {
        localStorage.setItem('clauseguard_guest_contracts', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
      return updated;
    });
  };

  const handleDeleteContract = (docId: string) => {
    setSessionContracts((prev) => {
      const next = prev.filter((c) => c.id !== docId);
      try {
        localStorage.setItem('clauseguard_guest_contracts', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Responsive tab switcher for smaller screens (mobile / tablet)
  const [activePane, setActivePane] = useState<'vault' | 'canvas' | 'copilot'>('canvas');

  const pollingIntervalRef = useRef<number | null>(null);

  // Polling contract processing status
  useEffect(() => {
    if (!activeDocId || analysis || !isUploading) return;

    const pollStatus = async () => {
      try {
        const status = await apiClient.getStatus(activeDocId);
        setJobStatus(status);

        if (status.is_completed) {
          if (pollingIntervalRef.current) {
            window.clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          const report = await apiClient.getAnalysis(activeDocId);
          setAnalysis(report);
          addSessionContract(report);
          setIsUploading(false);
          setVaultRefreshTrigger((prev) => prev + 1);
        } else if (status.current_stage === 'FAILED') {
          if (pollingIntervalRef.current) {
            window.clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setIsUploading(false);
          setVaultRefreshTrigger((prev) => prev + 1);
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
  }, [activeDocId, analysis, isUploading]);

  // Handle New Contract Upload
  const handleAnalyze = async (file: File, context?: string) => {
    try {
      setIsUploading(true);
      setContractFilename(file.name);
      setClientContext(context || '');
      setAnalysis(null);
      setJobStatus(null);
      setActivePane('canvas');

      const uploadRes = await apiClient.uploadContract(file, context);
      setActiveDocId(uploadRes.doc_id);

      // Instant cache return
      if (uploadRes.status === 'COMPLETED') {
        const report = await apiClient.getAnalysis(uploadRes.doc_id);
        setAnalysis(report);
        addSessionContract(report, file.size);
        setIsUploading(false);
        setVaultRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      alert('Failed to upload contract. Please ensure backend is running.');
    }
  };

  // Switch Active Contract from Vault Sidebar
  const handleSelectContract = async (docId: string) => {
    if (activeDocId === docId && analysis) {
      setActivePane('canvas');
      return;
    }
    setActiveDocId(docId);
    setAnalysis(null);
    setJobStatus(null);
    setIsUploading(true);
    setActivePane('canvas');

    try {
      const report = await apiClient.getAnalysis(docId);
      setAnalysis(report);
      addSessionContract(report);
      setContractFilename(report.contract_name);
      setIsUploading(false);
    } catch (err) {
      console.error('Failed to load contract analysis:', err);
      setIsUploading(false);
    }
  };

  // Reset to Upload New Contract
  const handleNewContract = () => {
    if (pollingIntervalRef.current) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setActiveDocId(null);
    setContractFilename('');
    setClientContext('');
    setJobStatus(null);
    setAnalysis(null);
    setIsUploading(false);
    setSelectedFilter('ALL');
    setCopilotTriggerMessage(null);
    setActivePane('canvas');
  };

  const handleAskCopilotAboutClause = (clause: ClauseAuditItem) => {
    const question = `Regarding ${clause.risk_id} (${clause.headline}, ${clause.citation.section}):\nWhy is this considered ${clause.risk_level} risk under Indian law, and how can I negotiate the recommended counter-term with the other party?`;
    setCopilotTriggerMessage(question);
    setActivePane('copilot');
  };

  const filteredFindings =
    analysis?.findings.filter((item) => {
      if (selectedFilter === 'ALL') return true;
      return item.risk_level === selectedFilter;
    }) || [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0c0e] text-[#f4f4f5] font-sans selection:bg-amber-500/20 selection:text-amber-200">
      {/* ========================================================================= */}
      {/* COLUMN 1: LEFT CONTRACT VAULT SIDEBAR (280px)                            */}
      {/* ========================================================================= */}
      <div className={`lg:flex ${activePane === 'vault' ? 'flex w-full z-40' : 'hidden lg:flex'}`}>
        <ContractVaultSidebar
          activeDocId={activeDocId}
          sessionContracts={sessionContracts}
          onSelectContract={(id) => {
            handleSelectContract(id);
            setActivePane('canvas');
          }}
          onNewContract={() => {
            handleNewContract();
            setActivePane('canvas');
          }}
          onDeleteContract={handleDeleteContract}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          refreshTrigger={vaultRefreshTrigger}
        />
      </div>

      {/* ========================================================================= */}
      {/* COLUMN 2: CENTER ACTIVE CONTRACT & AUDIT CANVAS (Flex-1)                 */}
      {/* ========================================================================= */}
      <section
        className={`flex-1 flex flex-col h-screen overflow-hidden ${
          activePane === 'canvas' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {/* Center Header */}
        <header className="h-14 border-b border-white/[0.06] bg-[#0c0d10] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 truncate">
            {activeDocId && analysis ? (
              <>
                <FileText className="h-4 w-4 text-amber-400 shrink-0" />
                <h2 className="text-xs font-bold text-white truncate max-w-md">
                  {contractFilename}
                </h2>
                <span className="hidden sm:inline-flex items-center space-x-1 rounded bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                  <span>SHA-256 Verified</span>
                </span>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h2 className="text-xs font-bold text-white tracking-wide">
                  Autonomous Legal Risk Intelligence Microservice
                </h2>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            {analysis && (
              <button
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center space-x-1.5 rounded-lg border border-white/[0.08] bg-[#14161d] px-3 py-1.5 text-xs font-mono font-medium text-zinc-300 hover:border-amber-500/40 hover:text-white transition"
              >
                <Download className="h-3.5 w-3.5 text-amber-400" />
                <span>Export Dossier</span>
              </button>
            )}

            {/* If user is guest, show top banner pill */}
            {(!user || user.is_guest) && (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition"
              >
                <span>Save Vault (Email)</span>
              </button>
            )}
          </div>
        </header>

        {/* Center Main Scroll Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* State 1: Dropzone Upload Ingestion Desk (if no contract selected) */}
          {!activeDocId && !isUploading && (
            <Dropzone onAnalyze={handleAnalyze} isLoading={isUploading} />
          )}

          {/* State 2: Processing Progress Stepper */}
          {isUploading && !analysis && (
            <ProgressStepper status={jobStatus} filename={contractFilename} />
          )}

          {/* State 3: Contract Audit Report View */}
          {analysis && !isUploading && (
            <div className="max-w-5xl mx-auto space-y-6 pb-28 sm:pb-36">
              {/* Executive Risk Gauge */}
              <RiskGauge
                score={analysis.overall_contract_risk_score}
                breakdown={analysis.risk_summary_breakdown}
                totalClauses={analysis.total_clauses_analyzed}
                flaggedCount={analysis.flagged_risks_count}
                contractName={analysis.contract_name}
              />

              {/* Severity Filter Tabs */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-white/[0.06]">
                <span className="flex items-center text-xs font-mono font-semibold text-zinc-500 mr-2 shrink-0 uppercase tracking-wider">
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

              {/* Clause Findings List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center space-x-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                    <span>Statutory Audit Findings ({filteredFindings.length})</span>
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-600">
                    Indian Contract Act 1872 Grounded
                  </span>
                </div>

                {filteredFindings.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.08] bg-[#121418] p-12 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
                    <h4 className="font-semibold text-white text-sm">
                      No contractual clauses in this tier
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 font-mono">
                      Select &apos;ALL&apos; to view all flagged terms.
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
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* COLUMN 3: RIGHT PERSISTENT LEGAL COUNSEL COPILOT DOCK (380px)            */}
      {/* ========================================================================= */}
      <aside
        className={`w-80 xl:w-96 shrink-0 h-screen flex flex-col bg-[#0d0e12] border-l border-white/[0.08] ${
          activePane === 'copilot' ? 'flex w-full z-40' : 'hidden lg:flex'
        }`}
      >
        <LegalCopilot
          docId={activeDocId || 'general_counsel'}
          contractName={contractFilename || 'General Legal Consultation'}
          initialContext={clientContext}
          externalTriggerMessage={copilotTriggerMessage}
          onClearTrigger={() => setCopilotTriggerMessage(null)}
        />
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE / TABLET BOTTOM NAVIGATION DOCK (when screen < lg)                 */}
      {/* ========================================================================= */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#0a0b0d] border-t border-white/[0.08] flex items-center justify-around z-50">
        <button
          onClick={() => setActivePane('vault')}
          className={`flex flex-col items-center justify-center text-[10px] font-mono ${
            activePane === 'vault' ? 'text-amber-400 font-bold' : 'text-zinc-500'
          }`}
        >
          <FileText className="h-4 w-4 mb-0.5" />
          <span>Vault</span>
        </button>

        <button
          onClick={() => setActivePane('canvas')}
          className={`flex flex-col items-center justify-center text-[10px] font-mono ${
            activePane === 'canvas' ? 'text-amber-400 font-bold' : 'text-zinc-500'
          }`}
        >
          <ShieldAlert className="h-4 w-4 mb-0.5" />
          <span>Audit Canvas</span>
        </button>

        <button
          onClick={() => setActivePane('copilot')}
          className={`flex flex-col items-center justify-center text-[10px] font-mono ${
            activePane === 'copilot' ? 'text-amber-400 font-bold' : 'text-zinc-500'
          }`}
        >
          <MessageSquare className="h-4 w-4 mb-0.5" />
          <span>Counsel Copilot</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONBOARDING & EMAIL AUTH MODAL                                            */}
      {/* ========================================================================= */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        canDismiss={true}
      />
    </div>
  );
}

export default App;
