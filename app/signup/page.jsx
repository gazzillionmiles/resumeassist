'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';
import { identifyUser, analytics } from '@/lib/client/analytics';
import { validatePassword, PASSWORD_CRITERIA } from '@/lib/password';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Lock, Mail, ArrowRight, CheckCircle, RefreshCw, Eye, EyeOff, Check, X, ShieldAlert } from 'lucide-react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState(null);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

  const { setAuth, setUser } = useAuthStore();
  const router = useRouter();

  const passwordAnalysis = useMemo(() => validatePassword(password), [password]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!passwordAnalysis.valid) {
      setError('Please satisfy all password complexity requirements before continuing.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.signup(email, password);

      if (res.token) {
        setAuth(res.token, res.user || { email, emailVerified: false });

        if (res.user?.id) {
          identifyUser(res.user.id);
        }

        analytics.signup('email');
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
        text:
          res.message ||
          'Verification email resent! Please check your inbox.',
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
        router.replace(data.user.is_profile_complete ? '/generate' : '/onboarding');
      } else {
        setResendStatus({
          type: 'error',
          text:
            'Email not verified yet. Please check your inbox and click the verification link.',
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
      <div className="min-h-screen flex flex-col bg-[#121316] text-[#F4F4F5]">
        <Header />

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl bg-[#18191D] border border-white/10 p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 flex items-center justify-center text-[#2CB7A5] mx-auto">
              <Mail className="w-6 h-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Check your email
              </h1>

              <p className="text-xs text-zinc-400 mt-1">
                We sent a verification link to your email address.
              </p>
            </div>

            <div className="font-mono text-xs text-zinc-200 bg-black/40 border border-white/5 px-3 py-2 rounded-xl inline-block max-w-full break-all">
              {signedUpEmail}
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
                type="button"
                onClick={handleCheckVerified}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider hover:bg-[#24998A] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <CheckCircle className="w-4 h-4 shrink-0" />

                <span>
                  {loading ? 'Checking status…' : "I've verified my email"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="w-full py-2.5 px-4 rounded-xl border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 shrink-0 ${
                    resending ? 'animate-spin' : ''
                  }`}
                />

                <span>
                  {resending ? 'Sending…' : 'Resend verification email'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSignedUpEmail(null);
                  setPassword('');
                  setResendStatus(null);
                  setError(null);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 cursor-pointer"
              >
                Change email / Sign up with another
              </button>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  const getStrengthColor = (strength) => {
    switch (strength) {
      case 'strong': return 'bg-[#2CB7A5] text-[#2CB7A5]';
      case 'good': return 'bg-emerald-400 text-emerald-400';
      case 'fair': return 'bg-amber-400 text-amber-400';
      default: return 'bg-red-400 text-red-400';
    }
  };

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
              Create your account
            </h1>

            <p className="text-xs text-zinc-400">
              One profile, tailored outreach for every role
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
                htmlFor="signup-email"
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
                  id="signup-email"
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
              <div className="flex items-center justify-between">
                <label
                  htmlFor="signup-password"
                  className="text-xs font-semibold text-zinc-300 block"
                >
                  Password
                </label>
                {password && (
                  <span className={`text-[11px] font-bold uppercase tracking-wider capitalize ${
                    passwordAnalysis.strength === 'strong'
                      ? 'text-[#2CB7A5]'
                      : passwordAnalysis.strength === 'good'
                      ? 'text-emerald-400'
                      : passwordAnalysis.strength === 'fair'
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}>
                    {passwordAnalysis.strength}
                  </span>
                )}
              </div>

              <div className="relative w-full">
                <Lock
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none z-10"
                />

                <input
                  id="signup-password"
                  className="input-field !pl-11 !pr-11 w-full"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (!passwordTouched) setPasswordTouched(true);
                  }}
                  onBlur={() => setPasswordTouched(true)}
                  autoComplete="new-password"
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

              {/* Password Strength Meter Bar */}
              {password && (
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full transition-all duration-300 ${
                      passwordAnalysis.strength === 'strong'
                        ? 'bg-[#2CB7A5] w-full'
                        : passwordAnalysis.strength === 'good'
                        ? 'bg-emerald-400 w-3/4'
                        : passwordAnalysis.strength === 'fair'
                        ? 'bg-amber-400 w-1/2'
                        : 'bg-red-400 w-1/4'
                    }`}
                  />
                </div>
              )}

              {/* Live Password Requirements Checklist */}
              {(passwordTouched || password) && (
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1.5 mt-2">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
                    Password Requirements:
                  </span>
                  <div className="grid grid-cols-1 gap-1 text-[11px]">
                    {PASSWORD_CRITERIA.map((criterion) => {
                      const isMet = passwordAnalysis.checks[criterion.id];
                      return (
                        <div
                          key={criterion.id}
                          className={`flex items-center gap-1.5 transition-colors ${
                            isMet ? 'text-[#2CB7A5] font-medium' : 'text-zinc-500'
                          }`}
                        >
                          {isMet ? (
                            <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
                          ) : (
                            <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                            </div>
                          )}
                          <span>{criterion.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
              By signing up, you agree to our{' '}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2CB7A5] hover:underline"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2CB7A5] hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-[#2CB7A5] hover:bg-[#24998A] text-[#121316] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || (password.length > 0 && !passwordAnalysis.valid)}
            >
              {loading ? (
                <span>Creating account…</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs text-zinc-400 pt-2 border-t border-white/5">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-[#2CB7A5] font-semibold hover:underline"
            >
              Log in
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
