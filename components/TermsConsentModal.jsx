'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ShieldCheck, ChevronDown, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';

export function TermsConsentModal({ isOpen = true, onAccepted }) {
  const { user, updateUser } = useAuthStore();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Tolerance of 30px from bottom
    const isBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 30;
    if (isBottom) {
      setHasScrolledToBottom(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkScrollPosition();
    }, 250);
    return () => clearTimeout(timer);
  }, [checkScrollPosition]);

  if (!isOpen) return null;

  const handleScroll = () => {
    checkScrollPosition();
  };

  const handleAccept = async () => {
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.acceptConsent('email');
      updateUser({ has_terms_consent: true, terms_consent_version: '2026-v1' });
      if (onAccepted) onAccepted();
    } catch (err) {
      setError(err.message || 'Failed to record consent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-[#141414] border border-white/10 shadow-2xl text-white overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-4 bg-[#181818]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 flex items-center justify-center text-[#2CB7A5] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">Terms of Service &amp; Privacy Policy</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                DPDP and Data Protection Compliance Notice
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Terms Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs leading-relaxed text-zinc-300 scroll-smooth overscroll-contain select-text"
          style={{ maxHeight: 'calc(85vh - 220px)' }}
        >
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              Please scroll through the legal terms below to review and enable the agreement checkbox.
            </span>
          </div>

          {/* Section 1: Terms of Service */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#2CB7A5] uppercase tracking-wider">
              Part 1: Terms of Service
            </h3>

            <div>
              <h4 className="font-semibold text-white mb-0.5">1. Acceptance of Terms</h4>
              <p>
                By accessing or using Outreach (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not access or use the Service.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-0.5">2. User Eligibility &amp; Accounts</h4>
              <p>
                You must be at least 18 years of age or possess legal authority to create an account. You are responsible for safeguarding your login credentials and for all activities that occur under your account.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-0.5">3. Acceptable Use Policy</h4>
              <p className="mb-1">You agree not to use Outreach for:</p>
              <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                <li>Sending unsolicited bulk email (spam) or violating anti-spam regulations (such as CAN-SPAM, GDPR, IT Act).</li>
                <li>Harassment, impersonation, defamatory communications, or fraudulent representations.</li>
                <li>Attempting to bypass platform rate limits, scrape private data, or reverse engineer platform services.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-0.5">4. AI-Generated Outputs Disclaimer</h4>
              <p>
                Outreach utilizes advanced language models and web research tools to draft outreach messages and synthesize company intel. All generated content, talking points, and analysis are provided on an &quot;AS IS&quot; assistive basis. You remain solely responsible for reviewing and verifying all outreach messages before dispatch.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3" />

          {/* Section 2: Privacy Policy */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#2CB7A5] uppercase tracking-wider">
              Part 2: Privacy Practices &amp; DPDP Compliance
            </h3>

            <div>
              <h4 className="font-semibold text-white mb-0.5">1. Data We Collect</h4>
              <p>
                We collect your account email address, authentication credentials, uploaded resume details (parsed skills, work history), target job postings, company research records, and message drafts to generate personalized outreach.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-0.5">2. Service Providers &amp; Infrastructure</h4>
              <p className="mb-1">We process data with trusted infrastructure providers under strict data privacy obligations:</p>
              <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                <li>Encrypted application database and user state storage</li>
                <li>Secure, server-side encrypted document storage for resumes</li>
                <li>Enterprise AI systems for assistive message drafting</li>
                <li>Licensed web search and company intelligence providers</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-0.5">3. Data Retention &amp; Right to Erasure</h4>
              <p>
                Under the Digital Personal Data Protection (DPDP) Act and international privacy standards, you maintain full rights to delete your personal data. When you request account deletion, a 30-day grace period is provided during which you can restore your account. After 30 days, all profile records, uploaded resumes, playbook entries, and generated messages are permanently purged.
              </p>
            </div>
          </div>

          <div className="pt-2 text-center text-[11px] text-[#2CB7A5] font-medium border-t border-dashed border-white/10">
            ✓ End of Terms &amp; Conditions and Privacy Policy
          </div>
        </div>

        {/* Footer & Consent Checkbox */}
        <div className="p-5 sm:p-6 border-t border-white/10 bg-[#181818]/90 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            {!hasScrolledToBottom ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                <ChevronDown className="w-4 h-4 animate-bounce" />
                <span>Scroll down the box above to enable checkbox</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-[#2CB7A5] font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Terms reviewed</span>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
              {error}
            </p>
          )}

          <label
            className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
              !hasScrolledToBottom
                ? 'opacity-50 cursor-not-allowed border-white/10 bg-white/5'
                : 'cursor-pointer border-[#2CB7A5]/30 bg-[#2CB7A5]/5 hover:border-[#2CB7A5]'
            }`}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={!hasScrolledToBottom || loading}
              className="mt-0.5 h-4 w-4 rounded border-[#2CB7A5] text-[#2CB7A5] focus:ring-[#2CB7A5] cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-xs text-zinc-200 leading-relaxed select-none">
              I have read, understood, and agree to the{' '}
              <Link href="/terms" target="_blank" className="text-[#2CB7A5] underline hover:opacity-80">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" target="_blank" className="text-[#2CB7A5] underline hover:opacity-80">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!agreed || loading || !hasScrolledToBottom}
            className="w-full py-3 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#24998A] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Recording Consent...</span>
              </>
            ) : (
              <span>Accept &amp; Continue</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TermsConsentModal;
