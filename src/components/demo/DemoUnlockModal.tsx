import { Building2, CheckCircle2, Clock, Mail, Phone, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { api } from '../../lib/api.ts';
import type { PublicDemoUser } from '../../shared/types.ts';

interface DemoUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: PublicDemoUser) => void;
}

export function DemoUnlockModal({ isOpen, onClose, onSuccess }: DemoUnlockModalProps) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim() || !email.trim() || !company.trim()) {
          throw new Error('Please enter your full name, work email, and company.');
        }
        const res = await api.registerDemoUser({
          full_name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          phone: phone.trim() || 'N/A',
          password: 'GitStackDemo2026!'
        });
        onSuccess(res.user);
        onClose();
      } else {
        if (!email.trim()) {
          throw new Error('Please enter your registered work email.');
        }
        const res = await api.loginDemoUser({
          email: email.trim(),
          password: 'GitStackDemo2026!'
        });
        onSuccess(res.user);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[var(--gs-primary)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 id="unlock-modal-title" className="font-display text-base font-bold text-slate-900">
                {mode === 'register' ? 'Unlock 24-Hour VIP Evaluation Pass' : 'Log In to Your 24-Hour Sandbox'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'register'
                  ? 'Access live webhook sync, CRM telemetry, and saved sandbox state'
                  : 'Resume your active evaluation session with your work email'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Benefits strip */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            <span>24-Hour Live Access</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Private Isolated Sandbox</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            <span>Real CRM Lead Sync</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Architect Priority Review</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gs-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company / Organization <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Retail & Logistics Corp."
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gs-primary)]"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Work Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@acmecorp.com"
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gs-primary)]"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone / WhatsApp / Viber <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 917 123 4567"
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gs-primary)]"
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode((m) => (m === 'register' ? 'login' : 'register'));
              }}
              className="text-xs font-medium text-[var(--gs-primary)] hover:underline"
            >
              {mode === 'register' ? 'Already have a pass? Log in' : 'New visitor? Unlock Pass'}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--gs-primary)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 transition-colors shadow-xs"
            >
              {loading
                ? 'Verifying...'
                : mode === 'register'
                  ? 'Start 24-Hour VIP Evaluation'
                  : 'Resume Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
