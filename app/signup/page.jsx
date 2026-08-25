'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState(null);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

  const { setAuth, setUser } = useAuthStore();
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.signup(email, password);
      if (res.token) {
        setAuth(res.token, res.user || { email, emailVerified: false });
      }
      setSignedUpEmail(email);
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!signedUpEmail) return;
    setResending(true);
    setResendStatus(null);
    try {
      const res = await api.resendVerification(signedUpEmail);
      setResendStatus({
        type: 'success',
        text: res.message || 'Verification email resent! Please check your inbox.',
      });
    } catch (err) {
      setResendStatus({
        type: 'error',
        text: err.message || 'Failed to resend verification email.',
      });
    } finally {
      setResending(false);
    }
  }

  async function handleCheckVerified() {
    setLoading(true);
    try {
      const data = await api.getMe();
      if (data?.user?.emailVerified) {
        setUser(data.user);
        router.replace('/profile');
      } else {
        setResendStatus({
          type: 'error',
          text: 'Email not verified yet. Please check your inbox and click the verification link.',
        });
      }
    } catch (err) {
      setResendStatus({
        type: 'error',
        text: err.message || 'Could not verify status. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }

  if (signedUpEmail) {
    return (
      <div className="min-h-screen flex flex-col justify-center px-6 max-w-sm mx-auto w-full">
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
          <h1 className="text-2xl font-display mb-2">Check your email</h1>
          <p className="text-sm text-ink/70 mb-2">
            Your verification link has been sent to your email address.
          </p>
          <p className="font-mono text-xs text-ink/90 bg-paper px-3 py-1.5 rounded inline-block mb-6">
            {signedUpEmail}
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
              onClick={handleCheckVerified}
              disabled={loading}
              className="btn-primary w-full cursor-pointer text-sm py-2.5"
            >
              {loading ? 'Checking status…' : "I've verified my email"}
            </button>
            <button
              onClick={handleResend}
              disabled={resending}
              className="btn-secondary w-full cursor-pointer text-sm py-2.5"
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
            <button
              onClick={() => {
                setSignedUpEmail(null);
                setPassword('');
                setResendStatus(null);
              }}
              className="text-xs text-ink/50 hover:text-ink mt-3 cursor-pointer"
            >
              Change email / Sign up with another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 max-w-sm mx-auto w-full">
      <h1 className="text-3xl mb-1">Create your account</h1>
      <p className="text-ink/60 mb-8">One profile, tailored outreach for every role.</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          className="input-field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input-field"
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && <p className="text-rust text-sm">{error}</p>}
        <button className="btn-primary mt-2 cursor-pointer" disabled={loading}>
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="text-sm text-ink/60 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-moss font-medium">
          Log in
        </Link>
      </p>
    </div>
  );
}
