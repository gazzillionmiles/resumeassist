'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/state/authStore';
import { api } from '@/lib/api';

export default function AuthGuard({ children }) {
  const { token, user, hydrated, hydrate, setUser, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

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
      if (err.status === 401) {
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
        if (err.status === 401) {
          logout();
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, token, pathname, router, setUser, logout]);

  if (!hydrated || !token || checking) {
    return <div className="min-h-screen flex items-center justify-center text-ink/50 text-sm">Loading…</div>;
  }

  // If authenticated but email is not verified, show verification-required state
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
      <div className="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <div className="card text-center py-8 px-6 shadow-sm">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-flare/15 text-flareDark mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-display mb-2">Verify your email</h1>
          <p className="text-sm text-ink/70 mb-2">
            Please verify your email address to access Outreach.
          </p>
          <p className="font-mono text-xs text-ink/90 bg-paper px-3 py-1.5 rounded inline-block mb-6">
            {user.email}
          </p>

          {resendStatus && (
            <div
              className={`text-xs p-3 rounded mb-4 ${
                resendStatus.type === 'success'
                  ? 'bg-mossLight/30 text-moss border border-moss/30'
                  : 'bg-rust/10 text-rust border border-rust/20'
              }`}
            >
              {resendStatus.text}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleRefresh}
              className="btn-primary w-full cursor-pointer text-sm py-2.5"
            >
              I&apos;ve verified my email
            </button>
            <button
              onClick={handleResend}
              disabled={resending}
              className="btn-secondary w-full cursor-pointer text-sm py-2.5"
            >
              {resending ? 'Sending email…' : 'Resend verification email'}
            </button>
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="text-xs text-ink/50 hover:text-ink mt-3 cursor-pointer"
            >
              Log in with a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
