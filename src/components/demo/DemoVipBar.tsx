import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  LogOut,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserCheck
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api, getStoredDemoToken, setStoredDemoToken } from '../../lib/api.ts';
import type { PublicDemoUser } from '../../shared/types.ts';
import { DemoUnlockModal } from './DemoUnlockModal.tsx';

interface DemoVipBarProps {
  onResetDemo: () => void;
  onNavigateToContact: () => void;
  onActivityTracked?: (action: string) => void;
}

function calculateRemainingTime(expiresAt?: string): {
  isExpired: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
} {
  if (!expiresAt) {
    return { isExpired: false, hours: 24, minutes: 0, seconds: 0, label: '24h 00m' };
  }
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) {
    return { isExpired: true, hours: 0, minutes: 0, seconds: 0, label: 'Expired' };
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return {
    isExpired: false,
    hours,
    minutes,
    seconds,
    label: `${hours}h ${String(minutes).padStart(2, '0')}m remaining`
  };
}

export function DemoVipBar({
  onResetDemo,
  onNavigateToContact,
  onActivityTracked
}: DemoVipBarProps) {
  const [currentUser, setCurrentUser] = useState<PublicDemoUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [remainingTime, setRemainingTime] = useState<{
    isExpired: boolean;
    hours: number;
    minutes: number;
    seconds: number;
    label: string;
  }>({ isExpired: false, hours: 24, minutes: 0, seconds: 0, label: '24h' });

  // Load existing session if present
  useEffect(() => {
    let mounted = true;
    const token = getStoredDemoToken();
    if (token) {
      api
        .getDemoMe()
        .then((user) => {
          if (mounted && user) {
            setCurrentUser(user);
          }
        })
        .catch(() => {
          if (mounted) setCurrentUser(null);
        });
    }
    return () => {
      mounted = false;
    };
  }, []);

  // Update timer every 10 seconds
  useEffect(() => {
    if (!currentUser?.expires_at) return;
    const update = () => {
      const rem = calculateRemainingTime(currentUser.expires_at);
      setRemainingTime(rem);
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [currentUser?.expires_at]);

  const handleLogout = () => {
    setStoredDemoToken(null);
    setCurrentUser(null);
  };

  const handleUserUnlocked = (user: PublicDemoUser) => {
    setCurrentUser(user);
    if (onActivityTracked) {
      onActivityTracked('VIP Sandbox Evaluation Pass Unlocked');
    }
  };

  return (
    <>
      <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-indigo-50/90 px-4 sm:px-6 py-2.5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Status & Session Badge */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {currentUser ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>24-Hour VIP Sandbox</span>
                </span>

                <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-800">
                  <Clock className="h-3.5 w-3.5 text-indigo-600" />
                  <span className={remainingTime.isExpired ? 'text-red-600 font-bold' : ''}>
                    {remainingTime.label}
                  </span>
                </span>

                <span className="hidden md:inline-flex items-center gap-1 text-slate-600">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  <strong>{currentUser.full_name}</strong> · {currentUser.company}
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200/80 px-2.5 py-0.5 font-medium text-slate-700">
                  <span>Guest Evaluation Mode</span>
                </span>
                <span className="text-slate-600">
                  Full 4-system SME sandbox with interactive simulations.
                </span>
              </>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {!currentUser ? (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors shadow-2xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>Unlock 24h VIP Pass (CRM &amp; Sync)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors"
                title="End evaluation pass"
              >
                <LogOut className="h-3 w-3" />
                <span>Exit Pass</span>
              </button>
            )}

            <button
              type="button"
              onClick={onResetDemo}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 transition-colors"
              title="Reset sample data back to initial defaults"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Sandbox</span>
            </button>

            <button
              type="button"
              onClick={onNavigateToContact}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--gs-primary)] px-3 py-1 font-semibold text-white hover:bg-[var(--gs-primary-hover)] transition-colors shadow-2xs"
            >
              <span>Get This for Your Business</span>
            </button>
          </div>
        </div>
      </div>

      <DemoUnlockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleUserUnlocked}
      />
    </>
  );
}
