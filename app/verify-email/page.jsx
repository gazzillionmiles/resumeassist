'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();
  const { user, setAuth, logout } = useAuthStore();

  const [state, setState] = useState(() => (token ? 'verifying' : 'no_token'));
  const [errorMessage, setErrorMessage] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (token) {
      api.verifyEmail(token)
        .then((res) => {
          if (cancelled) return;
          if (res.token && res.user) {
            setAuth(res.token, res.user);
          }
          setState('success');
        })
        .catch((err) => {
          if (cancelled) return;
          const code = err.body?.error;
          const msg = err.body?.message || err.message;
          if (code === 'token_expired') {
            setState('expired');
            setErrorMessage(msg || 'Your verification link has expired.');
          } else {
            setState('invalid');
            setErrorMessage(msg || 'This verification link is invalid or has already been used.');
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [token, setAuth]);

  const handleResend = async (e) => {
    if (e) e.preventDefault();
    const targetEmail = emailInput.trim() || user?.email;
    if (!targetEmail) {
      setResendMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }
    setResending(true);
    setResendMessage(null);
    try {
      const res = await api.resendVerification(targetEmail);
      setResendMessage({
        type: 'success',
        text: res.message || 'A new verification link has been sent to your email.',
      });
    } catch (err) {
      setResendMessage({
        type: 'error',
        text: err.message || 'Failed to send verification email. Please try again.',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto w-full">
      <div className="card p-8 text-center shadow-sm">
        {state === 'verifying' && (
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-mossLight/30 text-moss mb-4 animate-pulse">
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-display mb-2">Verifying your email</h1>
            <p className="text-sm text-ink/60">Please wait a moment while we verify your account…</p>
          </div>
        )}

        {state === 'success' && (
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-mossLight/40 text-moss mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-display mb-2">Email verified.</h1>
            <p className="text-sm text-ink/70 mb-6">
              Your email address has been successfully verified. You now have full access to Outreach.
            </p>
            <button
              onClick={() => router.push('/generate')}
              className="btn-primary w-full cursor-pointer text-sm"
            >
              Continue to Outreach
            </button>
          </div>
        )}

        {state === 'expired' && (
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rust/15 text-rust mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-display mb-2">Your verification link has expired.</h1>
            <p className="text-sm text-ink/70 mb-6">
              {errorMessage || 'Verification links are valid for 30 minutes. You can request a fresh one below.'}
            </p>

            {resendMessage && (
              <div
                className={`text-xs p-3 rounded mb-4 ${
                  resendMessage.type === 'success'
                    ? 'bg-mossLight/30 text-moss border border-moss/30'
                    : 'bg-rust/10 text-rust border border-rust/20'
                }`}
              >
                {resendMessage.text}
              </div>
            )}

            <form onSubmit={handleResend} className="flex flex-col gap-3">
              {!user?.email && (
                <input
                  className="input-field text-sm"
                  type="email"
                  placeholder="Enter your email address"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
              )}
              <button
                type="submit"
                disabled={resending}
                className="btn-primary w-full cursor-pointer text-sm"
              >
                {resending ? 'Sending…' : 'Send new verification email'}
              </button>
            </form>

            <div className="mt-4">
              <Link href="/login" className="text-xs text-moss hover:underline">
                Back to log in
              </Link>
            </div>
          </div>
        )}

        {state === 'invalid' && (
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rust/15 text-rust mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-display mb-2">Invalid verification link</h1>
            <p className="text-sm text-ink/70 mb-6">
              {errorMessage || 'This verification link is invalid or has already been used.'}
            </p>

            {resendMessage && (
              <div
                className={`text-xs p-3 rounded mb-4 ${
                  resendMessage.type === 'success'
                    ? 'bg-mossLight/30 text-moss border border-moss/30'
                    : 'bg-rust/10 text-rust border border-rust/20'
                }`}
              >
                {resendMessage.text}
              </div>
            )}

            <form onSubmit={handleResend} className="flex flex-col gap-3">
              {!user?.email && (
                <input
                  className="input-field text-sm"
                  type="email"
                  placeholder="Enter your email address"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
              )}
              <button
                type="submit"
                disabled={resending}
                className="btn-primary w-full cursor-pointer text-sm"
              >
                {resending ? 'Sending…' : 'Send new verification email'}
              </button>
            </form>

            <div className="mt-4">
              <Link href="/login" className="text-xs text-moss hover:underline">
                Back to log in
              </Link>
            </div>
          </div>
        )}

        {state === 'no_token' && (
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-flare/15 text-flareDark mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-display mb-2">Email verification</h1>
            <p className="text-sm text-ink/70 mb-6">
              Enter your email address to receive a verification link.
            </p>

            {resendMessage && (
              <div
                className={`text-xs p-3 rounded mb-4 ${
                  resendMessage.type === 'success'
                    ? 'bg-mossLight/30 text-moss border border-moss/30'
                    : 'bg-rust/10 text-rust border border-rust/20'
                }`}
              >
                {resendMessage.text}
              </div>
            )}

            <form onSubmit={handleResend} className="flex flex-col gap-3">
              <input
                className="input-field text-sm"
                type="email"
                placeholder="Enter your email address"
                value={emailInput || user?.email || ''}
                onChange={(e) => setEmailInput(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={resending}
                className="btn-primary w-full cursor-pointer text-sm"
              >
                {resending ? 'Sending…' : 'Send verification email'}
              </button>
            </form>

            <div className="mt-6 flex justify-center gap-4 text-xs text-ink/50">
              <Link href="/login" className="hover:text-ink">
                Log in
              </Link>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="hover:text-ink cursor-pointer"
              >
                Log out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-ink/50 text-sm">
          Loading…
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
