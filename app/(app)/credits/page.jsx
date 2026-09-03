'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';
import { analytics } from '@/lib/client/analytics';
import { useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Building2,
  Globe,
} from 'lucide-react';

export default function CreditsPage() {
  const { user, updateUser } = useAuthStore();

  const { data: creditsData, isLoading, refetch } = useQuery({
    queryKey: ['credits'],
    queryFn: api.getCredits,
  });

  useEffect(() => {
    analytics.paymentWallViewed({ source: 'credits_page' });
  }, []);

  useEffect(() => {
    if (creditsData) {
      updateUser({
        credits: {
          free: creditsData.freeCredits,
          purchased: creditsData.purchasedCredits,
          total: creditsData.totalCredits,
        },
      });
    }
  }, [creditsData, updateUser]);

  const freeCredits = creditsData?.freeCredits ?? user?.credits?.free ?? 5;
  const purchasedCredits = creditsData?.purchasedCredits ?? user?.credits?.purchased ?? 0;
  const totalCredits = creditsData?.totalCredits ?? (freeCredits + purchasedCredits);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 text-[#2CB7A5] text-xs font-semibold font-mono">
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Credits &amp; Plans</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Fuel Your Outreach
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
          Every generation includes deep company research, recipient role intelligence, and high-converting message drafting.
        </p>
      </div>

      {/* Current Balance Card */}
      <div className="glass-card p-6 sm:p-8 border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-gradient-to-r from-white/[0.02] to-[#2CB7A5]/[0.03]">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Available Balance
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-white font-mono">{totalCredits}</span>
            <span className="text-xs text-zinc-400">generations remaining</span>
          </div>
          <p className="text-xs text-zinc-500 pt-1">
            {freeCredits} free credits remaining &middot; {purchasedCredits} purchased credits
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/generate"
            className="btn-primary py-2.5 px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create Outreach</span>
          </Link>
        </div>
      </div>

      {/* Credit Rules Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 border border-white/10 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Globe className="w-4 h-4 text-[#2CB7A5]" />
            <span>Job Description Outreach</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Consumes <strong className="text-zinc-200">1 credit</strong>. Extracts full JD requirements, analyzes live company news, identifies conversation hooks, and generates custom email and LinkedIn drafts.
          </p>
        </div>

        <div className="glass-card p-5 border border-white/10 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Building2 className="w-4 h-4 text-[#2CB7A5]" />
            <span>Direct Company Outreach</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              BETA
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Consumes <strong className="text-zinc-200">1 credit</strong>. Discovers verified recruiters, analyzes recent company developments, and crafts persona-aware outreach.
          </p>
        </div>
      </div>

      {/* Plan & Pricing Options */}
      <div className="space-y-4 pt-4">
        <h2 className="text-base font-bold text-white text-center">Available Credit Plans</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Free Tier */}
          <div className="glass-card p-6 border border-white/10 rounded-2xl space-y-5 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-xs font-mono text-[#2CB7A5] font-semibold uppercase">Starter Tier</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">Free</span>
                <span className="text-xs text-zinc-400">/ account</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                5 free credits included upon registration to test and create outreach.
              </p>
              <ul className="space-y-2 text-xs text-zinc-300 pt-2 border-t border-white/10">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2CB7A5]" />
                  <span>5 Free Generations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2CB7A5]" />
                  <span>Deep Company Research</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2CB7A5]" />
                  <span>Target Recipient Discovery</span>
                </li>
              </ul>
            </div>

            <div className="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-center text-xs font-semibold text-zinc-400">
              Included with Account
            </div>
          </div>

          {/* Pro Pack */}
          <div className="glass-card p-6 border border-[#2CB7A5]/40 bg-[#2CB7A5]/5 rounded-2xl space-y-5 flex flex-col justify-between relative shadow-xl">
            <div className="space-y-3">
              <span className="text-xs font-mono text-[#2CB7A5] font-semibold uppercase">Pro Pack</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">50 Credits</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Ideal for active job seekers conducting high-volume targeted outreach.
              </p>
              <ul className="space-y-2 text-xs text-zinc-300 pt-2 border-t border-white/10">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2CB7A5]" />
                  <span>50 Custom Generations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2CB7A5]" />
                  <span>Priority Research Synthesis</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2CB7A5]" />
                  <span>Never Expiring Balance</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled
              onClick={() => analytics.paymentWallClicked({ pack: 'pro_50' })}
              className="py-2.5 px-4 rounded-xl bg-white/10 border border-white/15 text-center text-xs font-semibold text-zinc-400 cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Payments Coming Soon</span>
            </button>
          </div>

          {/* Growth Pack */}
          <div className="glass-card p-6 border border-white/10 rounded-2xl space-y-5 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-xs font-mono text-zinc-400 font-semibold uppercase">Growth Pack</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">150 Credits</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Maximum volume for comprehensive career searches and multi-team networking.
              </p>
              <ul className="space-y-2 text-xs text-zinc-300 pt-2 border-t border-white/10">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2CB7A5]" />
                  <span>150 Custom Generations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2CB7A5]" />
                  <span>Playbook Style Matcher</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2CB7A5]" />
                  <span>Lifetime Credit Validity</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled
              onClick={() => analytics.paymentWallClicked({ pack: 'growth_150' })}
              className="py-2.5 px-4 rounded-xl bg-white/10 border border-white/15 text-center text-xs font-semibold text-zinc-400 cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Payments Coming Soon</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
