import React, { useState } from 'react';
import { Shield, Mail, ArrowRight, UserCheck, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, canDismiss = false }) => {
  const { loginWithEmail, loginAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithEmail(email);
      onClose?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginAsGuest();
      onClose?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Guest access failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0e1014] p-7 shadow-2xl shadow-black/80">
        {canDismiss && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
              Enterprise Access Desk
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">ClauseGuard AI</h2>
          </div>
        </div>

        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          Sign in with your email to unlock your persistent multi-contract vault, saved statutory audits,
          and continuous legal counsel consultation history.
        </p>

        {error && (
          <div className="mb-4 flex items-center space-x-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Email Login Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Work or Personal Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full rounded-lg border border-white/[0.1] bg-[#14161d] pl-10 pr-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/40 font-mono transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center space-x-2 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-600 to-amber-700 py-2.5 px-4 text-xs font-bold text-white shadow-md shadow-amber-900/30 transition hover:from-amber-500 hover:to-amber-600 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Accessing Vault...' : 'Continue to Contract Vault'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center">
          <div className="flex-1 border-t border-white/[0.08]" />
          <span className="px-3 text-[10px] font-mono uppercase tracking-widest text-zinc-600">
            or instant test
          </span>
          <div className="flex-1 border-t border-white/[0.08]" />
        </div>

        {/* Guest Session Button (like ChatGPT) */}
        <button
          type="button"
          onClick={handleGuestSubmit}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center space-x-2 rounded-lg border border-white/[0.08] bg-[#14161d] py-2.5 px-4 text-xs font-medium text-zinc-300 hover:border-white/[0.2] hover:bg-white/[0.04] hover:text-white transition"
        >
          <UserCheck className="h-3.5 w-3.5 text-zinc-400" />
          <span>Continue as Demo Guest</span>
        </button>

        <p className="mt-4 text-center text-[10px] text-zinc-600 leading-normal">
          Guest sessions are ephemeral. Log in with email anytime to permanently sync your contracts.
        </p>
      </div>
    </div>
  );
};
