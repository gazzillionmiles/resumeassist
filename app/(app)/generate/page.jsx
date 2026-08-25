'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useGenerationStore } from '@/state/generationStore';

const TONE_OPTIONS = [
  { id: 'warm_professional', label: 'Warm & Professional', desc: 'Personable and polished' },
  { id: 'direct_concise', label: 'Direct & Concise', desc: 'Short, no filler' },
  { id: 'formal', label: 'Formal', desc: 'Traditional corporate tone' },
  { id: 'enthusiastic', label: 'Enthusiastic', desc: 'High energy & interest' },
];

export default function GeneratePage() {
  const router = useRouter();
  const setResult = useGenerationStore((s) => s.setResult);

  // Form State
  const [jobUrl, setJobUrl] = useState('');
  const [jdRawText, setJdRawText] = useState('');
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [tone, setTone] = useState('warm_professional');

  // Multi-step Flow State: 'input' | 'sources' | 'research'
  const [step, setStep] = useState('input');

  // Extracted Data
  const [jdStructured, setJdStructured] = useState(null);
  const [activeRawText, setActiveRawText] = useState('');
  const [sourceDomain, setSourceDomain] = useState(null);

  // Tavily Preliminary Sources
  const [discoveredSources, setDiscoveredSources] = useState([]);
  const [selectedSourceUrls, setSelectedSourceUrls] = useState(new Set());

  // Research Analysis Data
  const [companyResearch, setCompanyResearch] = useState(null);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);

  // Step 1: Parse JD + Tavily Search for Company News
  async function handleStartResearch(e) {
    if (e) e.preventDefault();
    setError(null);

    const trimmedUrl = jobUrl.trim();
    const trimmedText = jdRawText.trim();

    if (!trimmedUrl && !trimmedText) {
      setError('Please provide either a job posting URL or paste the job description text.');
      return;
    }

    if (trimmedText && trimmedText.length < 50) {
      setError('Job description text must be at least 50 characters.');
      return;
    }

    setLoading(true);

    try {
      let rawText = trimmedText;
      let structured = null;
      let domain = null;
      let sources = [];

      // 1. Extract & Structure JD (+ Tavily Search on server)
      if (!rawText && trimmedUrl) {
        setLoadingStep('Reading job posting & searching company developments (Tavily)…');
        try {
          const jdRes = await api.fetchJD({ jobUrl: trimmedUrl });
          rawText = jdRes.jdRawText;
          structured = jdRes.jdStructured;
          domain = jdRes.sourceDomain;
          sources = jdRes.sources || [];
        } catch (fetchErr) {
          setShowManualPaste(true);
          throw new Error(
            fetchErr.message ||
              'Could not read that job link automatically. Please paste the job description text below.'
          );
        }
      } else {
        setLoadingStep('Analyzing job description & searching company developments (Tavily)…');
        const jdRes = await api.fetchJD({ jdRawText: rawText });
        structured = jdRes.jdStructured;
        sources = jdRes.sources || [];
      }

      setActiveRawText(rawText);
      setJdStructured(structured);
      setSourceDomain(domain);

      if (sources.length > 0) {
        setDiscoveredSources(sources);
        // Default select top 3-5 sources
        setSelectedSourceUrls(new Set(sources.map((s) => s.url)));
        setStep('sources');
        return;
      }

      const company = (structured?.company || '').trim();
      const roleTitle = structured?.role_title || '';

      if (company && company.toLowerCase() !== 'unknown') {
        try {
          const searchRes = await api.searchCompanyResearch({ company, roleTitle });
          const retrySources = searchRes.sources || [];
          if (retrySources.length > 0) {
            setDiscoveredSources(retrySources);
            setSelectedSourceUrls(new Set(retrySources.map((s) => s.url)));
            setStep('sources');
            return;
          }
        } catch (searchErr) {
          console.warn('Tavily search notice:', searchErr.message);
        }
      }

      // If no company or no search results, proceed to tone selection / research fallback
      setStep('research');
    } catch (err) {
      setError(err.message || 'Analysis failed. Please check the inputs and try again.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }

  // Toggle selection of preliminary sources
  function toggleSource(url) {
    setSelectedSourceUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }

  // Step 2 -> Step 3: TinyFish Fetch & LLM Research Analysis
  async function handleFetchAndAnalyze() {
    setLoading(true);
    setError(null);

    const selectedSources = discoveredSources.filter((s) => selectedSourceUrls.has(s.url));

    try {
      setLoadingStep('Fetching full article content (TinyFish)…');
      setLoadingStep('Analyzing company initiatives & candidate connection (LLM)…');

      const analyzeRes = await api.analyzeCompanyResearch({
        company: jdStructured?.company || '',
        roleTitle: jdStructured?.role_title || '',
        jdStructured,
        sources: selectedSources,
      });

      setCompanyResearch(analyzeRes.research || null);
      setStep('research');
    } catch (err) {
      console.warn('Research analysis failed:', err.message);
      // Even if deep analysis fails, let user proceed to generate outreach
      setStep('research');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }

  // Step 4: Final Message Generation
  async function handleGenerateOutreach() {
    setLoading(true);
    setError(null);
    setLoadingStep('Drafting personalized messages…');

    try {
      const genResult = await api.generate({
        jobUrl: jobUrl.trim() || undefined,
        jdRawText: activeRawText,
        jdStructured,
        sourceDomain: sourceDomain || undefined,
        tone,
        companyResearch: companyResearch || null,
      });

      setResult(genResult);
      router.push('/generate/output');
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }

  return (
    <div className="pt-4">
      <h1 className="text-2xl mb-1">Send outreach</h1>
      <p className="text-ink/60 mb-6">
        Research target companies and craft hyper-tailored outreach in seconds.
      </p>

      {error && (
        <div className="border border-rust/40 bg-rust/5 rounded-md p-3 text-sm text-rust mb-4">
          <p className="font-medium">Notice</p>
          <p>{error}</p>
        </div>
      )}

      {/* STEP 1: JOB INPUT */}
      {step === 'input' && (
        <form onSubmit={handleStartResearch} className="flex flex-col gap-4">
          <section className="card flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-ink/50 font-medium">
                Job posting URL
              </span>
              <input
                type="url"
                className="input-field"
                placeholder="https://www.linkedin.com/jobs/view/... or company career page"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                disabled={loading}
              />
            </label>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                className="text-moss font-medium hover:underline cursor-pointer"
                onClick={() => setShowManualPaste((v) => !v)}
              >
                {showManualPaste ? '– Hide manual text paste' : '+ Or paste job description text directly'}
              </button>
            </div>

            {showManualPaste && (
              <label className="flex flex-col gap-1 pt-2 border-t border-ink/10">
                <span className="text-xs uppercase tracking-wide text-ink/50 font-medium">
                  Job Description Text (min 50 characters)
                </span>
                <textarea
                  className="input-field min-h-36 text-sm"
                  placeholder="Paste the full job description, qualifications, and requirements here…"
                  value={jdRawText}
                  onChange={(e) => setJdRawText(e.target.value)}
                  disabled={loading}
                />
              </label>
            )}
          </section>

          <button
            type="submit"
            className="btn-primary w-full mt-2"
            disabled={loading || (!jobUrl.trim() && !jdRawText.trim())}
          >
            {loading ? loadingStep || 'Extracting & Researching…' : 'Research Company & Start Outreach'}
          </button>
        </form>
      )}

      {/* STEP 2: SHOW PRELIMINARY SOURCES (TAVILY) & SELECT SOURCES */}
      {step === 'sources' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <section className="card flex flex-col gap-2 bg-moss/5 border-moss/20">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono text-moss uppercase tracking-wide">
                  Target Identified
                </span>
                <h2 className="text-lg font-semibold text-ink">
                  {jdStructured?.company || 'Target Company'}
                </h2>
                <p className="text-xs text-ink/60">
                  {jdStructured?.role_title || 'Role'} · {jdStructured?.location || 'Location'}
                </p>
              </div>
              <span className="stamp">Tavily Search</span>
            </div>
          </section>

          <section className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-ink/50 font-medium">
                Preliminary Sources Discovered ({discoveredSources.length})
              </span>
              <span className="text-[11px] text-ink/40">Select 3–5 sources to analyze</span>
            </div>

            <div className="flex flex-col gap-2">
              {discoveredSources.map((source, idx) => {
                const isSelected = selectedSourceUrls.has(source.url);
                return (
                  <div
                    key={idx}
                    onClick={() => toggleSource(source.url)}
                    className={`p-3 rounded-md border text-sm transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'border-moss bg-moss/10 text-ink shadow-sm'
                        : 'border-ink/15 hover:border-ink/30 bg-paperRaised text-ink/70 opacity-75'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-1 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs text-ink line-clamp-1">{source.title}</p>
                      <p className="text-[11px] text-ink/50 truncate mt-0.5">{source.url}</p>
                      {source.content && (
                        <p className="text-[11px] text-ink/70 line-clamp-2 mt-1 font-sans">
                          {source.content}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={handleFetchAndAnalyze}
                disabled={loading || selectedSourceUrls.size === 0}
              >
                {loading
                  ? loadingStep || 'Fetching full articles via TinyFish…'
                  : `Fetch & Analyze Selected (${selectedSourceUrls.size})`}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep('research')}
                disabled={loading}
              >
                Skip Analysis
              </button>
            </div>
          </section>
        </div>
      )}

      {/* STEP 3 & 4: RESEARCH BRIEF + TONE SELECTION */}
      {step === 'research' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {companyResearch ? (
            <section className="card flex flex-col gap-3 border border-moss/30 bg-moss/5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-moss font-semibold flex items-center gap-1.5">
                  <span>✦</span> LLM Research Intelligence Analysis
                </p>
                <span className="stamp">TinyFish Grounded</span>
              </div>

              {companyResearch.conversation_hook && (
                <div className="p-2.5 bg-paper rounded border border-ink/10">
                  <span className="text-[11px] font-semibold text-ink/60 uppercase block mb-0.5">
                    Conversation Hook
                  </span>
                  <p className="text-xs text-ink font-medium leading-relaxed">
                    {companyResearch.conversation_hook}
                  </p>
                </div>
              )}

              {companyResearch.candidate_connection && (
                <div>
                  <span className="text-[11px] font-semibold text-ink/60 uppercase block mb-0.5">
                    Candidate Connection
                  </span>
                  <p className="text-xs text-ink/80 leading-relaxed">
                    {companyResearch.candidate_connection}
                  </p>
                </div>
              )}

              {companyResearch.recent_developments?.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-ink/60 uppercase block mb-1">
                    Recent Developments
                  </span>
                  <ul className="text-xs text-ink/80 list-disc list-inside space-y-1">
                    {companyResearch.recent_developments.map((dev, i) => (
                      <li key={i} className="leading-relaxed">
                        {dev}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {companyResearch.sources_used?.length > 0 && (
                <div className="pt-2 border-t border-ink/10 flex flex-wrap items-center gap-2 text-[11px] text-ink/50">
                  <span className="font-medium">Sources:</span>
                  {companyResearch.sources_used.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-moss hover:underline truncate max-w-[200px]"
                      title={source.title || source.url}
                    >
                      {source.title || source.url}
                    </a>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="card flex items-center justify-between bg-paperRaised">
              <div>
                <p className="text-xs uppercase text-ink/40 font-medium">Target Role</p>
                <p className="font-medium text-sm">
                  {jdStructured?.role_title || 'Target Role'} at {jdStructured?.company || 'Company'}
                </p>
              </div>
              <span className="stamp">JD Parsed</span>
            </section>
          )}

          {/* TONE SELECTION */}
          <section className="card flex flex-col gap-3">
            <span className="text-xs uppercase tracking-wide text-ink/50 font-medium">
              Select outreach tone
            </span>
            <div className="grid grid-cols-2 gap-2">
              {TONE_OPTIONS.map((opt) => {
                const selected = tone === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setTone(opt.id)}
                    disabled={loading}
                    className={`text-left p-3 rounded-md border text-sm transition-all cursor-pointer ${
                      selected
                        ? 'border-flare bg-flare/10 font-medium text-ink shadow-sm'
                        : 'border-ink/15 hover:border-ink/30 bg-paperRaised text-ink/80'
                    }`}
                  >
                    <p className="font-semibold text-xs">{opt.label}</p>
                    <p className="text-[11px] text-ink/60 mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep('input')}
              disabled={loading}
            >
              Back
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={handleGenerateOutreach}
              disabled={loading}
            >
              {loading ? loadingStep || 'Drafting messages…' : 'Generate Outreach'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
