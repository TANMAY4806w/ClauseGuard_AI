import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  FileText,
  Trash2,
  LogOut,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  BookmarkCheck,
} from 'lucide-react';
import type { ContractListItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

interface ContractVaultSidebarProps {
  activeDocId: string | null;
  sessionContracts?: ContractListItem[];
  onSelectContract: (docId: string) => void;
  onNewContract: () => void;
  onOpenAuthModal: () => void;
  onDeleteContract?: (docId: string) => void;
  refreshTrigger?: number;
}

export const ContractVaultSidebar: React.FC<ContractVaultSidebarProps> = ({
  activeDocId,
  sessionContracts = [],
  onSelectContract,
  onNewContract,
  onOpenAuthModal,
  onDeleteContract,
  refreshTrigger = 0,
}) => {
  const { user, logout } = useAuth();
  const [serverContracts, setServerContracts] = useState<ContractListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadContracts();
  }, [user, refreshTrigger]);

  const loadContracts = async () => {
    if (!user || user.is_guest) {
      setServerContracts([]);
      return;
    }
    setIsLoading(true);
    try {
      const list = await apiClient.getUserContracts();
      setServerContracts(list);
    } catch (err) {
      console.error('Failed to load user contracts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Merge server contracts and active session contracts (avoiding duplicates by id)
  const combinedContracts: ContractListItem[] = React.useMemo(() => {
    const map = new Map<string, ContractListItem>();
    // First insert session contracts safely
    (sessionContracts || []).forEach((c) => map.set(c.id, c));
    // Then overwrite with server contracts if any
    (serverContracts || []).forEach((c) => map.set(c.id, c));
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [sessionContracts, serverContracts]);

  const handleDelete = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this contract from your vault?')) return;
    setDeletingId(docId);
    try {
      if (user && !user.is_guest) {
        await apiClient.deleteContract(docId);
        setServerContracts((prev) => prev.filter((c) => c.id !== docId));
      }
      onDeleteContract?.(docId);
      if (activeDocId === docId) {
        onNewContract();
      }
    } catch (err) {
      console.error('Failed to delete contract:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) {
      return (
        <span className="inline-flex items-center space-x-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-400 border border-rose-500/20">
          <AlertTriangle className="h-2.5 w-2.5" />
          <span>{score}% RISK</span>
        </span>
      );
    }
    if (score >= 40) {
      return (
        <span className="inline-flex items-center space-x-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/20">
          <span>{score}% ELEVATED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="h-2.5 w-2.5" />
        <span>{score}% SAFE</span>
      </span>
    );
  };

  return (
    <aside className="w-72 shrink-0 border-r border-white/[0.08] bg-[#0c0d10] flex flex-col justify-between h-screen select-none">
      {/* Top Section */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Brand Bar - exact h-14 height */}
        <div className="h-14 shrink-0 px-4 border-b border-white/[0.06] flex items-center justify-between bg-[#0c0d10]">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-white tracking-wide">ClauseGuard AI</h1>
              <div className="text-[10px] font-mono text-zinc-500 tracking-wider">
                Enterprise Legal Vault
              </div>
            </div>
          </div>
        </div>

        {/* User Account / Guest Card */}
        <div className="p-3 mx-3 mt-3 rounded-xl border border-white/[0.08] bg-[#121419] flex items-center justify-between">
          <div className="truncate pr-2">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-white truncate max-w-[120px]">
                {user && !user.is_guest ? user.email.split('@')[0] : 'Demo Guest'}
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[9px] font-mono uppercase font-bold ${
                  user && !user.is_guest
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-white/[0.06]'
                }`}
              >
                {user && !user.is_guest ? 'Vault' : 'Guest'}
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono truncate">
              {user && !user.is_guest ? user.email : 'Ephemeral session'}
            </div>
          </div>

          <div>
            {user && !user.is_guest ? (
              <button
                onClick={logout}
                title="Sign out of vault"
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.05] hover:text-rose-400 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={onOpenAuthModal}
                title="Save contracts permanently with email"
                className="inline-flex items-center space-x-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/25 transition shadow-sm"
              >
                <BookmarkCheck className="h-3 w-3" />
                <span>Save</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Action Button: + New Contract */}
        <div className="p-3">
          <button
            onClick={onNewContract}
            className={`w-full flex items-center justify-center space-x-2 rounded-lg py-2 px-3 text-xs font-bold transition-all ${
              activeDocId === null
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40 border border-amber-500/50'
                : 'border border-white/[0.08] bg-[#14161d] text-zinc-300 hover:border-amber-500/40 hover:text-white'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Upload New Contract</span>
          </button>
        </div>

        {/* Vault History Header */}
        <div className="px-4 py-2 flex items-center justify-between text-[11px] font-mono text-zinc-500 uppercase tracking-widest border-t border-white/[0.04]">
          <span className="flex items-center space-x-1.5 text-zinc-400 font-semibold">
            <Layers className="h-3 w-3 text-amber-400" />
            <span>Your Contracts ({combinedContracts.length})</span>
          </span>
          {isLoading && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />}
        </div>

        {/* Scrollable Contract Vault List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {combinedContracts.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <FileText className="h-8 w-8 text-zinc-700 mx-auto mb-2 opacity-40" />
              <p className="text-xs text-zinc-400 font-medium">No contracts in vault</p>
              <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                Drop a PDF or test with our 1-click sample to see verified findings.
              </p>
            </div>
          ) : (
            combinedContracts.map((c) => {
              const isSelected = activeDocId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectContract(c.id)}
                  className={`group relative flex flex-col rounded-lg p-2.5 transition cursor-pointer border ${
                    isSelected
                      ? 'border-amber-500/60 bg-amber-500/[0.1] text-white shadow-md shadow-amber-950/40'
                      : 'border-white/[0.04] bg-[#101216]/60 hover:border-white/[0.1] hover:bg-white/[0.02] text-zinc-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 truncate pr-2">
                      <FileText
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isSelected ? 'text-amber-400' : 'text-zinc-500'
                        }`}
                      />
                      <span className="text-xs font-semibold truncate leading-tight">
                        {c.filename}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, c.id)}
                      disabled={deletingId === c.id}
                      title="Delete contract"
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </span>

                    <div>{getRiskBadge(c.risk_score)}</div>
                  </div>

                  {isSelected && (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-amber-400 opacity-80">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="h-10 shrink-0 px-3 border-t border-white/[0.06] bg-[#090a0d] text-[10px] font-mono text-zinc-500 flex items-center justify-between">
        <span className="flex items-center space-x-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>Statutory Grounding Active</span>
        </span>
        <span className="text-amber-400/80">ICA 1872</span>
      </div>
    </aside>
  );
};
