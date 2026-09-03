import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Terms of Service | Outreach',
  description: 'Terms of Service and conditions for using Outreach assistive outreach platform.',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col bg-[#121316] text-[#F4F4F5]">
      <Header />
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-16 flex-1 w-full">
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 text-xs mb-8 text-[#2CB7A5] hover:underline"
        >
          &larr; Back to Outreach
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-white">
          Terms of Service
        </h1>
        <p className="text-xs text-zinc-500 mb-8 font-mono">
          Last Updated: August 2026 &middot; Version 2026-v1
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-zinc-300">
          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">1. Agreement to Terms</h2>
            <p>
              By accessing or using Outreach (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access or use the Service.
            </p>
          </section>

          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">2. Eligibility &amp; User Accounts</h2>
            <p>
              You must be at least 18 years of age to use this platform. You agree to provide accurate and complete registration details and maintain the security of your password and credentials.
            </p>
          </section>

          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">3. Acceptable Use Policy</h2>
            <p>You agree not to use Outreach to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>Transmit unlawful, defamatory, harassing, or deceptive content.</li>
              <li>Generate unsolicited bulk spam or violate anti-spam legislation.</li>
              <li>Attempt unauthorized access to our platform, user accounts, or underlying systems.</li>
              <li>Reverse engineer, decompile, or exploit our proprietary generation algorithms and platform systems.</li>
            </ul>
          </section>

          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">4. Assistive AI &amp; Research Disclaimer</h2>
            <p>
              All generated outreach messages, talking points, and company research summaries are provided on an &quot;AS IS&quot; assistive basis. You remain solely responsible for reviewing and verifying the accuracy and appropriateness of all communications prior to sending them.
            </p>
          </section>

          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">5. Account Termination &amp; Deletion</h2>
            <p>
              You may terminate your account at any time through the Profile settings. In compliance with DPDP regulations, account deletion is subject to a 30-day grace period, after which all personal data and uploaded materials are permanently purged.
            </p>
          </section>

          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">6. Contact Information</h2>
            <p>
              For legal questions or inquiries regarding these Terms, please contact us at:
            </p>
            <p className="font-mono text-xs text-[#2CB7A5]">
              <a href="mailto:support@wavyai.in" className="underline">
                support@wavyai.in
              </a>
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
