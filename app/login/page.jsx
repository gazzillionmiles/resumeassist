'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';
import { identifyUser, analytics } from '@/lib/client/analytics';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { setAuth } = useAuthStore();
  const router = useRouter();
  const params = useSearchParams();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(email, password);

      if (res.token) {
        setAuth(res.token, res.user || { email, emailVerified: false });

        if (res.user?.id) {
          identifyUser(res.user.id);
        }

        analytics.login('email');
      }

      const defaultTarget = res.user?.is_profile_complete === false ? '/onboarding' : '/generate';
      router.replace(params.get('next') || defaultTarget);
    } catch (err) {
      setError(
        err.message || 'Login failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#121316] text-[#F4F4F5]">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-[#18191D] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <Image
              src="/Outreach.png"
              alt="Outreach Logo"
              width={48}
              height={48}
              className="w-12 h-12 rounded-2xl object-contain mx-auto shadow-lg"
              priority
            />

            <h1 className="text-2xl font-bold tracking-tight text-white">
              Welcome back
            </h1>

            <p className="text-xs text-zinc-400">
              Log in to draft your next tailored outreach
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="text-xs font-semibold text-zinc-300 block"
              >
                Email address
              </label>

              <div className="relative w-full">
                <Mail
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none z-10"
                />

                <input
                  id="login-email"
                  className="input-field !pl-11 w-full"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="text-xs font-semibold text-zinc-300 block"
              >
                Password
              </label>

              <div className="relative w-full">
                <Lock
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none z-10"
                />

                <input
                  id="login-password"
                  className="input-field !pl-11 !pr-11 w-full"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer p-1"
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-[#2CB7A5] hover:bg-[#24998A] text-[#121316] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <span>Logging in…</span>
              ) : (
                <>
                  <span>Log in</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs text-zinc-400 pt-2 border-t border-white/5">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="text-[#2CB7A5] font-semibold hover:underline"
            >
              Sign up
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function Login() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#121316] text-zinc-500 text-sm">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}