'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/state/authStore';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Sparkles, ArrowRight, Search, ShieldCheck, Mail } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { token, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && token) {
      router.replace('/generate');
    }
  }, [hydrated, token, router]);

  return (
    <div className="min-h-screen flex flex-col bg-[#121316] text-[#F4F4F5]">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center text-center">
        {/* Logo & Hero Icon */}
        <div className="mb-6">
          <Image
            src="/Outreach.png"
            alt="Outreach Official Logo"
            width={64}
            height={64}
            className="w-16 h-16 rounded-2xl object-contain mx-auto shadow-2xl border border-white/10"
            priority
          />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 text-[#2CB7A5] text-xs font-semibold mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Intelligent Job Outreach &amp; Live Intel</span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.15] mb-6">
          Turn any job posting into{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2CB7A5] to-teal-200">
            grounded, high-converting outreach
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mb-10 leading-relaxed">
          Outreach analyzes job requirements, conducts real-time research on target companies, and drafts personalized email &amp; LinkedIn messages in your unique voice.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md justify-center mb-16">
          <Link
            href="/signup"
            className="btn-primary w-full sm:w-auto px-6 py-3 text-xs font-bold uppercase tracking-wider shadow-xl flex items-center justify-center gap-2"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="btn-secondary w-full sm:w-auto px-6 py-3 text-xs font-semibold flex items-center justify-center gap-2"
          >
            <span>Log In</span>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left w-full max-w-5xl">
          <div className="glass-card p-6 space-y-3 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 flex items-center justify-center text-[#2CB7A5]">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Live Company Research</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Fetches recent company developments, strategic priorities, and news from verified sources so you always have a timely hook.
            </p>
          </div>

          <div className="glass-card p-6 space-y-3 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 flex items-center justify-center text-[#2CB7A5]">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Hyper-Tailored Outreach</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Generates concise cold emails and LinkedIn connection notes crafted from your background and the role&apos;s exact requirements.
            </p>
          </div>

          <div className="glass-card p-6 space-y-3 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 flex items-center justify-center text-[#2CB7A5]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">DPDP &amp; Privacy First</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your resume and drafts remain private. Full compliance with DPDP data protection and 30-day grace period account erasure.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
