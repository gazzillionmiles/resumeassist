import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy Policy | Outreach',
  description: 'How Outreach collects, handles, and protects your personal data under DPDP and data protection standards.',
};

export default function PrivacyPolicy() {
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
          Privacy Policy
        </h1>
        <p className="text-xs text-zinc-500 mb-8 font-mono">
          Last Updated: August 2026 &middot; Version 2026-v1
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-zinc-300">
          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">1. Overview</h2>
            <p>
              Outreach (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) provides assistive job search outreach intelligence, company research synthesis, and outreach message drafting. This Privacy Policy details how we collect, process, retain, and protect your information in compliance with the Digital Personal Data Protection (DPDP) Act and applicable international data protection laws.
            </p>
          </section>

          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">2. Information We Collect</h2>
            <p>We process the following categories of personal data:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Account &amp; Authentication:</strong> Your email address, encrypted password hash, email verification status, and consent records.
              </li>
              <li>
                <strong className="text-zinc-200">Professional Profile &amp; Resume:</strong> Current title, target roles, location, CTC expectations, and structured parsed information extracted from your uploaded resume.
              </li>
              <li>
                <strong className="text-zinc-200">Target Job Postings &amp; Research:</strong> Job descriptions, URLs provided for analysis, synthesized company news, and personalized outreach drafts.
              </li>
              <li>
                <strong className="text-zinc-200">Compliance &amp; Consent Logs:</strong> Timestamp, IP address, user-agent, and consent version captured upon agreement.
              </li>
            </ul>
          </section>

          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">3. Service Providers &amp; Sub-Processors</h2>
            <p>
              We process personal data only with trusted enterprise cloud infrastructure and third-party service providers bound by strict confidentiality and data protection obligations:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li><strong className="text-zinc-200">Cloud Database:</strong> Secure cloud database providers for application data storage.</li>
              <li><strong className="text-zinc-200">Encrypted Document Storage:</strong> Enterprise cloud storage providers with server-side encryption for secure resume storage.</li>
              <li><strong className="text-zinc-200">AI &amp; Language Modeling:</strong> Enterprise AI inference providers for assistive text analysis and synthesis.</li>
              <li><strong className="text-zinc-200">Web Search &amp; Research:</strong> Licensed search and web data providers for public company information retrieval.</li>
            </ul>
          </section>

          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">4. Data Retention &amp; Right to Erasure (DPDP)</h2>
            <p>
              In compliance with DPDP data minimization and erasure principles:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                You have the right to request deletion of your account and personal data at any time via your Profile settings.
              </li>
              <li>
                Upon deletion request, a <strong>30-day grace period</strong> is initiated, during which you may restore your account.
              </li>
              <li>
                After 30 days, your user profile, uploaded resumes, playbook examples, and outreach records are permanently purged.
              </li>
              <li>
                Immutable audit logs are retained solely to record the deletion event for legal and compliance verification.
              </li>
            </ul>
          </section>

          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">5. Security Safeguards</h2>
            <p>
              We enforce industry-standard security safeguards including TLS 1.3 encryption in transit, AES-256 server-side encryption at rest, salted password hashing, and strict authorization boundaries.
            </p>
          </section>

          <section className="glass-card p-6 border border-white/10 space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">6. Contact &amp; Grievance Officer</h2>
            <p>
              For privacy requests, data access inquiries, or grievance redressal, please contact our Data Protection Officer at:
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
