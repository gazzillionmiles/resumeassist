'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Mail, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-[#121316] text-[#F4F4F5]">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-[#18191D] border border-white/10 p-6 sm:p-8 shadow-2xl text-center space-y-5">
          {state === 'verifying' && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 flex items-center justify-center text-[#2CB7A5] mx-auto animate-pulse">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Verifying your email</h1>
              <p className="text-xs text-zinc-400">Please wait while we confirm your account…</p>
            </div>
          )}

          {state === 'success' && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 flex items-center justify-center text-[#2CB7A5] mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Email verified!</h1>
              <p className="text-xs text-zinc-400">
                Your email has been verified. You now have full access to Outreach.
              </p>
              <button
                onClick={() => router.push(user?.is_profile_complete ? '/generate' : '/onboarding')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider hover:bg-[#24998A] transition-all cursor-pointer shadow-md"
              >
                Continue to Outreach
              </button>
            </div>
          )}

          {state === 'expired' && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Link expired</h1>
              <p className="text-xs text-zinc-400">
                {errorMessage || 'Verification links expire after 30 minutes. You can request a fresh link below.'}
              </p>

              {resendMessage && (
                <div
                  className={`text-xs p-3 rounded-xl ${
                    resendMessage.type === 'success'
                      ? 'bg-[#2CB7A5]/10 text-[#2CB7A5] border border-[#2CB7A5]/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}
                >
                  {resendMessage.text}
                </div>
              )}

              <form onSubmit={handleResend} className="space-y-3">
                {!user?.email && (
                  <input
                    className="input-field text-xs"
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
                  className="w-full py-2.5 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider hover:bg-[#24998A] transition-all cursor-pointer disabled:opacity-50"
                >
                  {resending ? 'Sending…' : 'Send new verification email'}
                </button>
              </form>

              <div className="pt-2">
                <Link href="/login" className="text-xs text-[#2CB7A5] hover:underline">
                  Back to login
                </Link>
              </div>
            </div>
          )}

          {state === 'invalid' && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Invalid link</h1>
              <p className="text-xs text-zinc-400">
                {errorMessage || 'This verification link is invalid or has already been used.'}
              </p>

              {resendMessage && (
                <div
                  className={`text-xs p-3 rounded-xl ${
                    resendMessage.type === 'success'
                      ? 'bg-[#2CB7A5]/10 text-[#2CB7A5] border border-[#2CB7A5]/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}
                >
                  {resendMessage.text}
                </div>
              )}

              <form onSubmit={handleResend} className="space-y-3">
                {!user?.email && (
                  <input
                    className="input-field text-xs"
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
                  className="w-full py-2.5 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider hover:bg-[#24998A] transition-all cursor-pointer disabled:opacity-50"
                >
                  {resending ? 'Sending…' : 'Send new verification email'}
                </button>
              </form>

              <div className="pt-2">
                <Link href="/login" className="text-xs text-[#2CB7A5] hover:underline">
                  Back to login
                </Link>
              </div>
            </div>
          )}

          {state === 'no_token' && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 flex items-center justify-center text-[#2CB7A5] mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Email verification</h1>
              <p className="text-xs text-zinc-400">
                Enter your email address to receive a fresh verification link.
              </p>

              {resendMessage && (
                <div
                  className={`text-xs p-3 rounded-xl ${
                    resendMessage.type === 'success'
                      ? 'bg-[#2CB7A5]/10 text-[#2CB7A5] border border-[#2CB7A5]/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}
                >
                  {resendMessage.text}
                </div>
              )}

              <form onSubmit={handleResend} className="space-y-3">
                <input
                  className="input-field text-xs"
                  type="email"
                  placeholder="you@example.com"
                  value={emailInput || user?.email || ''}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  disabled={resending}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider hover:bg-[#24998A] transition-all cursor-pointer disabled:opacity-50"
                >
                  {resending ? 'Sending…' : 'Send verification email'}
                </button>
              </form>

              <div className="pt-2 flex justify-center gap-4 text-xs text-zinc-500">
                <Link href="/login" className="hover:text-zinc-300">
                  Log in
                </Link>
                <span>&bull;</span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push('/login');
                  }}
                  className="hover:text-zinc-300 cursor-pointer"
                >
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#121316] text-zinc-500 text-sm">
          Loading…
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
