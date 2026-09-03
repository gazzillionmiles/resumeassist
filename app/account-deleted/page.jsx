'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Clock, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#121316] text-[#F4F4F5]">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full rounded-2xl bg-[#18191D] border border-white/10 p-6 sm:p-8 text-center shadow-2xl space-y-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Account Deletion Scheduled
            </h1>
            <p className="text-sm text-zinc-400">
              Your account has been placed into the 30-day grace period.
            </p>
          </div>

          <div className="text-xs text-zinc-300 bg-black/40 p-5 rounded-xl border border-white/5 space-y-3 text-left leading-relaxed">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
              <Clock className="w-4 h-4" />
              <span>30-Day Restoration Window Active</span>
            </div>
            <p>
              Your profile data, uploaded resume, and outreach history will remain safely stored for 30 days. If you log back into Outreach during this period, you can restore your account with one click.
            </p>
            <p className="text-zinc-500 text-[11px]">
              After 30 days, your data (including all uploaded files and generations) will be permanently purged in accordance with DPDP compliance.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/login"
              className="flex-1 py-3 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider hover:bg-[#24998A] transition-all flex items-center justify-center gap-1.5 shadow-md"
            >
              <span>Back to Login</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
