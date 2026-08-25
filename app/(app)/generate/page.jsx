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

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);

  async function handleGenerate(e) {
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
    setLoadingStep('Extracting job, researching company & generating tailored outreach…');

    try {
      const genResult = await api.generate({
        jobUrl: trimmedUrl || undefined,
        jdRawText: trimmedText || undefined,
        tone,
      });

      setResult(genResult);
      router.push('/generate/output');
    } catch (err) {
      setError(err.message || 'Generation failed. Please check the inputs and try again.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }

  return (
    <div className="pt-4">
      <h1 className="text-2xl mb-1">Send outreach</h1>
      <p className="text-ink/60 mb-6">
        Automatically research target companies and craft hyper-tailored outreach and interview talking points in seconds.
      </p>

      {error && (
        <div className="border border-rust/40 bg-rust/5 rounded-md p-3 text-sm text-rust mb-4">
          <p className="font-medium">Notice</p>
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleGenerate} className="flex flex-col gap-4">
        {/* JOB INPUT */}
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
              disabled={loading}
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

        <button
          type="submit"
          className="btn-primary w-full mt-2"
          disabled={loading || (!jobUrl.trim() && !jdRawText.trim())}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-paper" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>{loadingStep || 'Researching company & generating outreach…'}</span>
            </span>
          ) : (
            'Generate Outreach'
          )}
        </button>
      </form>
    </div>
  );
}
