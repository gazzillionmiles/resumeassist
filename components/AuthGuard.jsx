'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore } from '@/state/authStore';
import { api } from '@/lib/api';
import TermsConsentModal from './TermsConsentModal';
import { Mail, AlertTriangle, RefreshCw, LogOut, CheckCircle } from 'lucide-react';

export default function AuthGuard({ children }) {
  const { token, user, hydrated, hydrate, setUser, updateUser, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const verifyStatus = useCallback(async () => {
    if (!token) {
      setChecking(false);
      return;
    }
    try {
      const data = await api.getMe();
      if (data?.user) {
        setUser(data.user);
      }
    } catch (err) {
      if (err.status === 401 || err.body?.error === 'account_purged') {
        logout();
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    } finally {
      setChecking(false);
    }
  }, [token, setUser, logout, router, pathname]);

  useEffect(() => {
    let cancelled = false;
    if (!hydrated) return;

    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    api.getMe()
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          setUser(data.user);
        }
        setChecking(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401 || err.body?.error === 'account_purged') {
          logout();
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, token, pathname, router, setUser, logout]);

  useEffect(() => {
    if (!hydrated || checking) return;
    if (user && user.emailVerified && user.deletion_status !== 'pending_deletion') {
      if (user.is_profile_complete === false && pathname !== '/onboarding') {
        router.replace('/onboarding');
      }
    }
  }, [hydrated, checking, user, pathname, router]);

  if (!hydrated || !token || checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#121316] text-zinc-400 text-sm gap-3">
        <Image
          src="/Outreach.png"
          alt="Outreach Logo"
          width={40}
          height={40}
          className="w-10 h-10 rounded-xl object-contain animate-pulse shadow-md"
          priority
        />
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="w-3.5 h-3.5 border-2 border-[#2CB7A5] border-t-transparent rounded-full animate-spin" />
          <span>Loading Outreach…</span>
        </div>
      </div>
    );
  }

  // 1. Pending Deletion Screen
  if (user && user.deletion_status === 'pending_deletion') {
    const handleRestore = async () => {
      setRestoring(true);
      setRestoreStatus(null);
      try {
        const res = await api.restoreAccount();
        updateUser({ deletion_status: 'active', scheduled_purge_at: null });
        setRestoreStatus({ type: 'success', text: res.message || 'Account successfully restored!' });
      } catch (err) {
        setRestoreStatus({ type: 'error', text: err.message || 'Failed to restore account.' });
      } finally {
        setRestoring(false);
      }
    };

    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#121316] text-white">
        <div className="max-w-md w-full rounded-2xl bg-[#18191D] border border-amber-500/30 p-6 sm:p-8 text-center shadow-2xl space-y-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Account Pending Deletion</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Your account is currently in the 30-day grace period.
            </p>
          </div>

          <div className="text-xs text-zinc-300 bg-black/40 p-4 rounded-xl border border-white/5 space-y-2 text-left">
            <p>
              Your account is scheduled for permanent data purge on:
            </p>
            <p className="font-mono text-amber-400 text-[11px] font-semibold">
              {user.scheduled_purge_at ? new Date(user.scheduled_purge_at).toLocaleString() : 'Within 30 days'}
            </p>
            <p className="text-zinc-400 text-[11px]">
              You can restore your account now to regain full access to generation and history.
            </p>
          </div>

          {restoreStatus && (
            <div
              className={`text-xs p-3 rounded-xl ${
                restoreStatus.type === 'success'
                  ? 'bg-[#2CB7A5]/10 text-[#2CB7A5] border border-[#2CB7A5]/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}
            >
              {restoreStatus.text}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider hover:bg-[#24998A] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {restoring ? 'Restoring Account…' : 'Restore Account'}
            </button>
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Email Verification Required Screen
  if (user && user.emailVerified === false) {
    const handleResend = async () => {
      setResending(true);
      setResendStatus(null);
      try {
        const res = await api.resendVerification(user.email);
        setResendStatus({ type: 'success', text: res.message || 'Verification email sent. Please check your inbox.' });
      } catch (err) {
        setResendStatus({ type: 'error', text: err.message || 'Failed to send verification email. Please try again later.' });
      } finally {
        setResending(false);
      }
    };

    const handleRefresh = async () => {
      setChecking(true);
      await verifyStatus();
    };

    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#121316] text-white">
        <div className="max-w-md w-full rounded-2xl bg-[#18191D] border border-white/10 p-6 sm:p-8 text-center shadow-2xl space-y-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 text-[#2CB7A5]">
            <Mail className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Verify your email</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Please verify your email address to access Outreach features.
            </p>
          </div>

          <div className="font-mono text-xs text-zinc-200 bg-black/40 border border-white/5 px-3 py-2 rounded-xl inline-block">
            {user.email}
          </div>

          {resendStatus && (
            <div
              className={`text-xs p-3 rounded-xl ${
                resendStatus.type === 'success'
                  ? 'bg-[#2CB7A5]/10 text-[#2CB7A5] border border-[#2CB7A5]/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}
            >
              {resendStatus.text}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleRefresh}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider hover:bg-[#24998A] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>I&apos;ve verified my email</span>
            </button>
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full py-2.5 px-4 rounded-xl border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
            >
              {resending ? 'Sending email…' : 'Resend verification email'}
            </button>
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 cursor-pointer"
            >
              Log in with a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Incomplete Profile Redirect Guard
  if (user && user.is_profile_complete === false && pathname !== '/onboarding') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#121316] text-zinc-400 text-sm gap-3">
        <div className="w-4 h-4 border-2 border-[#2CB7A5] border-t-transparent rounded-full animate-spin" />
        <span>Redirecting to profile setup…</span>
      </div>
    );
  }

  // 4. Terms Consent Verification
  return (
    <>
      {user && !user.has_terms_consent && (
        <TermsConsentModal
          isOpen={true}
          onAccepted={() => {
            updateUser({ has_terms_consent: true });
          }}
        />
      )}
      {children}
    </>
  );
}
