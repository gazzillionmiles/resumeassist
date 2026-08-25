'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);
  const router = useRouter();
  const params = useSearchParams();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await api.login(email, password);
      setToken(token);
      router.replace(params.get('next') || '/generate');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 max-w-sm mx-auto w-full">
      <h1 className="text-3xl mb-1">Welcome back</h1>
      <p className="text-ink/60 mb-8">Log in to draft your next outreach.</p>
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-rust text-sm">{error}</p>}
        <button className="btn-primary mt-2 cursor-pointer" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="text-sm text-ink/60 mt-6">
        No account?{' '}
        <Link href="/signup" className="text-moss font-medium">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-ink/50 text-sm">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
