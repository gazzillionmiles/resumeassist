'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useGenerationStore } from '@/state/generationStore';
import { useAuthStore } from '@/state/authStore';
import { analytics } from '@/lib/client/analytics';
import {
  Sparkles,
  Globe,
  FileText,
  Building2,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowRight,
  UserCheck,
  ExternalLink,
  Check,
  RefreshCw,
  CreditCard,
  X,
  Zap,
  AlertTriangle,
} from 'lucide-react';

const TONE_OPTIONS = [
  { id: 'warm_professional', label: 'Warm & Professional', desc: 'Personable, enthusiastic, and polished' },
  { id: 'direct_concise', label: 'Direct & Concise', desc: 'Short, sharp, zero fluff or filler' },
  { id: 'formal', label: 'Formal', desc: 'Traditional corporate executive tone' },
  { id: 'enthusiastic', label: 'Enthusiastic', desc: 'High energy, curiosity & startup passion' },
];

export default function GeneratePage() {
  const router = useRouter();
  const setResult = useGenerationStore((s) => s.setResult);
  const { user, updateCredits } = useAuthStore();

  // Active Mode: 'job' (Existing JD flow) | 'company' (New Company Outreach flow)
  const [activeTab, setActiveTab] = useState('job');

  // Common State
  const [tone, setTone] = useState('warm_professional');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [showPaymentWall, setShowPaymentWall] = useState(false);

  // --- JOB OUTREACH STATE (Existing Flow) ---
  const [jobUrl, setJobUrl] = useState('');
  const [jdRawText, setJdRawText] = useState('');
  const [showManualPaste, setShowManualPaste] = useState(false);

  // --- COMPANY OUTREACH STATE (New Flow) ---
  const [companyName, setCompanyName] = useState('');
  const [discoveredPeople, setDiscoveredPeople] = useState([]);
  const [discoveredSources, setDiscoveredSources] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [peopleSearched, setPeopleSearched] = useState(false);
  const [peopleLoading, setPeopleLoading] = useState(false);

  // Existing JD Generation Handler (DO NOT CHANGE)
  async function handleGenerateJobOutreach(e) {
    if (e) e.preventDefault();
    setError(null);

    const trimmedUrl = jobUrl.trim();
    const trimmedText = jdRawText.trim();

    if (!trimmedUrl && !trimmedText) {
      setError('Please provide either a job posting URL or paste the job description text.');
      return;
    }

    if (!trimmedUrl && trimmedText.length < 50) {
      setError('Job description text must be at least 50 characters.');
      return;
    }

    setLoading(true);
    setLoadingStep('Analyzing job posting, fetching live company news & generating outreach…');
    analytics.generationStarted({ tone, has_url: Boolean(trimmedUrl) });

    try {
      const genResult = await api.generate({
        jobUrl: trimmedUrl || undefined,
        jdRawText: trimmedText || undefined,
        tone,
      });

      if (genResult.credits) {
        updateCredits(genResult.credits);
      }

      analytics.generationCompleted({ tone });
      setResult(genResult);
      router.push('/generate/output');
    } catch (err) {
      if (
        err.body?.code === 'NO_CREDITS' ||
        err.status === 402 ||
        err.message?.includes('NO_CREDITS') ||
        err.message?.includes('free generations')
      ) {
        setShowPaymentWall(true);
        analytics.creditExhausted({ feature: 'job_outreach' });
        analytics.paymentWallViewed({ trigger: 'zero_credits_job_outreach' });
      } else {
        analytics.generationFailed({ error: err.message });
        setError(err.message || 'Generation failed. Please check the inputs and try again.');
      }
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }

  // New Company Outreach: Step 1 - Search People & Research Company
  async function handleSearchCompanyPeople(e) {
    if (e) e.preventDefault();
    setError(null);

    const cleanCompany = companyName.trim();
    if (!cleanCompany) {
      setError('Please enter a target company name.');
      return;
    }

    setPeopleLoading(true);
    setLoadingStep(`Searching for Talent Acquisition & Recruiting team at ${cleanCompany}…`);
    analytics.contactSearchStarted({ company: cleanCompany });

    try {
      const res = await api.researchCompanyPeople({ companyName: cleanCompany });
      const people = res.people || [];
      setDiscoveredPeople(people);
      setDiscoveredSources(res.sources || []);
      setPeopleSearched(true);
      if (people.length > 0) {
        setSelectedPerson(people[0]); // Default to highest-relevance person
        analytics.contactSelected({ role: people[0].title });
      } else {
        setSelectedPerson(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to discover company contacts. Please try again.');
    } finally {
      setPeopleLoading(false);
      setLoadingStep('');
    }
  }

  // New Company Outreach: Step 2 - Generate Outreach for Selected Person
  async function handleGenerateCompanyOutreach(e) {
    if (e) e.preventDefault();
    setError(null);

    const cleanCompany = companyName.trim();
    if (!cleanCompany) {
      setError('Company name is required.');
      return;
    }

    if (!selectedPerson) {
      setError('Please select a target recruiter or Talent Acquisition person to contact.');
      return;
    }

    setLoading(true);
    setLoadingStep(`Synthesizing company intel and drafting personalized outreach for ${selectedPerson.name}…`);
    analytics.companyOutreachStarted({ tone, company: cleanCompany });

    try {
      const genResult = await api.generateCompanyOutreach({
        companyName: cleanCompany,
        selectedPeople: [selectedPerson],
        tone,
      });

      if (genResult.credits) {
        updateCredits(genResult.credits);
      }

      analytics.companyOutreachCompleted({ tone, company: cleanCompany });
      setResult(genResult);
      router.push('/generate/output');
    } catch (err) {
      if (
        err.body?.code === 'NO_CREDITS' ||
        err.status === 402 ||
        err.message?.includes('NO_CREDITS') ||
        err.message?.includes('free generations')
      ) {
        setShowPaymentWall(true);
        analytics.creditExhausted({ feature: 'company_outreach' });
        analytics.paymentWallViewed({ trigger: 'zero_credits_company_outreach' });
      } else {
        analytics.generationFailed({ error: err.message });
        setError(err.message || 'Company outreach generation failed. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Send Outreach</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Research target companies, extract conversation hooks, and draft hyper-tailored outreach in seconds.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setActiveTab('job');
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'job'
              ? 'bg-[#2CB7A5] text-[#121316] shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Job Posting Outreach</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('company');
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'company'
              ? 'bg-[#2CB7A5] text-[#121316] shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Company Outreach (No JD)</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
            activeTab === 'company'
              ? 'bg-[#121316]/20 text-[#121316]'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}>
            BETA
          </span>
        </button>
      </div>

      {/* Beta Accuracy Disclaimer for Company Outreach */}
      {activeTab === 'company' && (
        <div className="border border-amber-500/30 bg-amber-500/10 rounded-2xl p-4 text-xs text-amber-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-200">Company Outreach Mode</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                BETA
              </span>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              This feature is in active beta. Automated contact discovery and company news synthesis may occasionally produce incomplete or less accurate results. Please double-check recipient names, titles, and company context before sending.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 rounded-2xl p-4 text-xs text-red-400">
          <p className="font-semibold text-red-300">Notice</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: EXISTING JOB OUTREACH FLOW (100% PRESERVED)       */}
      {/* ======================================================== */}
      {activeTab === 'job' && (
        <form onSubmit={handleGenerateJobOutreach} className="space-y-5">
          {/* JOB INPUT */}
          <section className="glass-card p-5 sm:p-6 space-y-4 border border-white/10">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#2CB7A5]" />
                <span>Job Posting URL</span>
              </label>
              <input
                type="url"
                className="input-field text-xs"
                placeholder="https://www.linkedin.com/jobs/view/... or company careers page"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                className="text-[#2CB7A5] hover:underline font-medium flex items-center gap-1 cursor-pointer"
                onClick={() => setShowManualPaste((v) => !v)}
                disabled={loading}
              >
                {showManualPaste ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Hide manual text paste</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Or paste job description text directly</span>
                  </>
                )}
              </button>
            </div>

            {showManualPaste && (
              <div className="space-y-1.5 pt-3 border-t border-white/10">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#2CB7A5]" />
                  <span>Job Description Text (min 50 characters)</span>
                </label>
                <textarea
                  className="input-field min-h-36 text-xs"
                  placeholder="Paste the full job description, qualifications, and requirements here…"
                  value={jdRawText}
                  onChange={(e) => setJdRawText(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
          </section>

          {/* TONE SELECTION */}
          <section className="glass-card p-5 sm:p-6 space-y-3 border border-white/10">
            <span className="text-xs font-semibold text-zinc-300 block">
              Select Outreach Tone
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TONE_OPTIONS.map((opt) => {
                const selected = tone === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setTone(opt.id)}
                    disabled={loading}
                    className={`text-left p-3.5 rounded-xl border text-xs transition-all cursor-pointer ${
                      selected
                        ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 font-semibold text-white shadow-md'
                        : 'border-white/10 hover:border-white/20 bg-black/20 text-zinc-300'
                    }`}
                  >
                    <p className="font-bold text-xs text-white">{opt.label}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            type="submit"
            className="btn-primary w-full py-3.5 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg"
            disabled={loading || (!jobUrl.trim() && !jdRawText.trim())}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{loadingStep || 'Researching company & generating outreach…'}</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Generate Outreach &amp; Intel</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>
      )}

      {/* ======================================================== */}
      {/* TAB 2: NEW COMPANY OUTREACH FLOW (NO JD)                 */}
      {/* ======================================================== */}
      {activeTab === 'company' && (
        <div className="space-y-5">
          {/* STEP 1: COMPANY NAME INPUT & DISCOVERY */}
          <section className="glass-card p-5 sm:p-6 space-y-4 border border-white/10">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#2CB7A5]" />
                <span>Target Company Name</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  className="input-field text-xs flex-1"
                  placeholder="e.g. Stripe, OpenAI, Figma, Datadog"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setPeopleSearched(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchCompanyPeople();
                    }
                  }}
                  disabled={peopleLoading || loading}
                />
                <button
                  type="button"
                  onClick={handleSearchCompanyPeople}
                  disabled={peopleLoading || loading || !companyName.trim()}
                  className="btn-primary py-2.5 px-5 text-xs font-bold shrink-0 cursor-pointer"
                >
                  {peopleLoading ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Finding People…</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>{peopleSearched ? 'Re-discover People' : 'Discover Contacts'}</span>
                    </span>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Outreach will search and discover verified Talent Acquisition, Technical Recruiters, and hiring leaders for this company.
              </p>
            </div>
          </section>

          {/* STEP 2: DISCOVERED PEOPLE SELECTION */}
          {peopleSearched && (
            <section className="glass-card p-5 sm:p-6 space-y-4 border border-[#2CB7A5]/30 bg-[#2CB7A5]/5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#2CB7A5]/20 pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#2CB7A5]" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Discovered Talent Acquisition &amp; Recruiters ({discoveredPeople.length})
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#2CB7A5] font-semibold">Select 1 Recipient</span>
              </div>

              {discoveredPeople.length === 0 ? (
                <div className="p-4 bg-black/40 rounded-xl border border-white/10 text-center space-y-2">
                  <p className="text-xs text-zinc-400">
                    No specific recruiting profiles were discovered for &ldquo;{companyName}&rdquo;.
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    You can retry with a different company name spelling or continue with general Talent Acquisition outreach.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const fallbackPerson = {
                        name: 'Talent Acquisition Team',
                        title: 'Talent Acquisition Leader',
                        company: companyName.trim(),
                        relevance_reason: `Recruiting team at ${companyName.trim()}`,
                      };
                      setDiscoveredPeople([fallbackPerson]);
                      setSelectedPerson(fallbackPerson);
                      analytics.contactSelected({ role: fallbackPerson.title });
                    }}
                    className="btn-secondary text-xs py-1.5 px-3 mt-2 inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Use General Talent Team</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {discoveredPeople.map((person, idx) => {
                    const isSelected = selectedPerson?.name === person.name && selectedPerson?.profile_url === person.profile_url;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedPerson(person);
                          analytics.contactSelected({ role: person.title });
                        }}
                        className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-[#2CB7A5] bg-[#2CB7A5]/15 shadow-md'
                            : 'border-white/10 hover:border-white/20 bg-black/30'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{person.name}</span>
                            {isSelected && (
                              <span className="w-4 h-4 rounded-full bg-[#2CB7A5] text-[#121316] flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#2CB7A5] font-medium">{person.title}</p>
                          {person.relevance_reason && (
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                              <span className="text-zinc-500 font-semibold">Why relevant: </span>
                              {person.relevance_reason}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          {person.profile_url && (
                            <a
                              href={person.profile_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-zinc-400 hover:text-[#2CB7A5] flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 hover:border-[#2CB7A5]/30 transition-colors"
                            >
                              <span>LinkedIn</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* STEP 3: TONE SELECTION & GENERATION */}
          {peopleSearched && selectedPerson && (
            <>
              <section className="glass-card p-5 sm:p-6 space-y-3 border border-white/10 animate-fade-in">
                <span className="text-xs font-semibold text-zinc-300 block">
                  Select Outreach Tone
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TONE_OPTIONS.map((opt) => {
                    const selected = tone === opt.id;
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setTone(opt.id)}
                        disabled={loading}
                        className={`text-left p-3.5 rounded-xl border text-xs transition-all cursor-pointer ${
                          selected
                            ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 font-semibold text-white shadow-md'
                            : 'border-white/10 hover:border-white/20 bg-black/20 text-zinc-300'
                        }`}
                      >
                        <p className="font-bold text-xs text-white">{opt.label}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <button
                type="button"
                onClick={handleGenerateCompanyOutreach}
                className="btn-primary w-full py-3.5 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg animate-fade-in"
                disabled={loading || !selectedPerson}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{loadingStep || 'Synthesizing company intel & drafting outreach…'}</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Outreach for {selectedPerson.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* PAYMENT WALL MODAL */}
      {showPaymentWall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-[#18191D] border border-amber-500/30 p-6 sm:p-8 text-center space-y-6 shadow-2xl">
            <button
              onClick={() => setShowPaymentWall(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mx-auto">
              <Zap className="w-7 h-7 fill-current" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-white">
                You&apos;ve used your 5 free generations.
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Get more credits to continue creating personalized outreach and deep company research.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Link
                href="/credits"
                onClick={() => {
                  analytics.paymentWallClicked({ source: 'modal' });
                  setShowPaymentWall(false);
                }}
                className="btn-primary w-full py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Get Credits</span>
              </Link>

              <button
                type="button"
                onClick={() => setShowPaymentWall(false)}
                className="btn-secondary w-full py-2.5 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
