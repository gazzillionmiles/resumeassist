'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useGenerationStore } from '@/state/generationStore';

export default function OutputClient({ result }) {
  const router = useRouter();
  const clear = useGenerationStore((s) => s.clear);
  const [emailSubject, setEmailSubject] = useState(result.emailSubject || '');
  const [emailBody, setEmailBody] = useState(result.emailBody || '');
  const [linkedinMessage, setLinkedinMessage] = useState(result.linkedinMessage || '');
  const [note, setNote] = useState(null);

  async function persist() {
    if (!result.generationId) return;
    try {
      await api.patchGeneration(result.generationId, {
        emailSubject,
        emailOutput: emailBody,
        linkedinOutput: linkedinMessage,
      });
      setNote('Saved');
      setTimeout(() => setNote(null), 1500);
    } catch {
      // Background save error ignored gracefully
    }
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      if (result.generationId) {
        await api.patchGeneration(result.generationId, { markCopiedOrShared: true });
      }
      setNote(`${label} copied!`);
      setTimeout(() => setNote(null), 1500);
    } catch {
      setNote('Failed to copy to clipboard');
      setTimeout(() => setNote(null), 2000);
    }
  }

  async function share(text, label) {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text });
        if (result.generationId) {
          await api.patchGeneration(result.generationId, { markCopiedOrShared: true });
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          await copy(text, label);
        }
      }
    } else {
      await copy(text, label);
    }
  }

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl">Ready to send</h1>
        <span className="stamp">Drafted</span>
      </div>
      <p className="text-ink/60 mb-4">Edit anything, then copy or share directly.</p>

      {note && (
        <div className="fixed top-4 right-4 bg-ink text-paper px-4 py-2 rounded-md shadow-lg text-xs font-mono z-50 animate-fade-in">
          {note}
        </div>
      )}

      {result.companyResearch && (
        <section className="card mb-4 border border-moss/30 bg-moss/5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-moss/20 pb-2">
            <div>
              <span className="text-[11px] font-mono text-moss uppercase tracking-wider font-semibold">
                ✦ Company Research & Intel
              </span>
              <h2 className="text-base font-bold text-ink">
                {result.companyResearch.company_name || result.company_name || 'Target Company'}
              </h2>
            </div>
            <span className="stamp">Grounded Intel</span>
          </div>

          {/* PART 1: Here is what Outreach found about this company */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide font-semibold text-ink/70 flex items-center gap-1.5">
              <span>🔍</span> Here is what Outreach found about this company:
            </h3>

            {/* Recent Developments */}
            {Array.isArray(result.companyResearch.recent_developments) &&
              result.companyResearch.recent_developments.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-ink/60 uppercase block mb-1">
                    Recent Developments
                  </span>
                  <div className="flex flex-col gap-2">
                    {result.companyResearch.recent_developments.map((dev, i) => {
                      if (typeof dev === 'string') {
                        return (
                          <div
                            key={i}
                            className="p-2.5 bg-paper rounded border border-ink/10 text-xs text-ink/80 leading-relaxed"
                          >
                            {dev}
                          </div>
                        );
                      }
                      return (
                        <div
                          key={i}
                          className="p-2.5 bg-paper rounded border border-ink/10 flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-ink">
                              {dev.headline || 'Development'}
                            </span>
                            {dev.date && (
                              <span className="text-[10px] font-mono text-ink/50 bg-ink/5 px-1.5 py-0.5 rounded border border-ink/10">
                                {dev.date}
                              </span>
                            )}
                          </div>
                          {dev.summary && (
                            <p className="text-xs text-ink/80 leading-relaxed mt-0.5">
                              {dev.summary}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Relevance to role */}
            {result.companyResearch.relevance && (
              <div className="p-2.5 bg-paper rounded border border-ink/10">
                <span className="text-[11px] font-semibold text-ink/60 uppercase block mb-0.5">
                  Why it is relevant to this role
                </span>
                <p className="text-xs text-ink/80 leading-relaxed">
                  {result.companyResearch.relevance}
                </p>
              </div>
            )}

            {/* Sources used */}
            {Array.isArray(result.companyResearch.sources_used) &&
              result.companyResearch.sources_used.length > 0 && (
                <div className="pt-2 border-t border-ink/10 flex flex-wrap items-center gap-2 text-[11px] text-ink/50">
                  <span className="font-semibold text-ink/60">Sources used:</span>
                  {result.companyResearch.sources_used.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-moss hover:underline truncate max-w-[220px]"
                      title={source.title || source.url}
                    >
                      {source.title || (source.url ? new URL(source.url).hostname : 'Source')}
                    </a>
                  ))}
                </div>
              )}
          </div>

          {/* PART 2: Here is how this research was used in your outreach */}
          {(result.companyResearch.conversation_hook ||
            result.companyResearch.candidate_connection) && (
            <div className="flex flex-col gap-2 pt-3 border-t border-moss/20">
              <h3 className="text-xs uppercase tracking-wide font-semibold text-moss flex items-center gap-1.5">
                <span>🎯</span> Here is how this research was used in your outreach:
              </h3>

              {result.companyResearch.conversation_hook && (
                <div className="p-2.5 bg-paper rounded border border-moss/30 shadow-xs">
                  <span className="text-[11px] font-semibold text-moss uppercase block mb-0.5">
                    Conversation / Personalization Hook
                  </span>
                  <p className="text-xs text-ink font-medium leading-relaxed">
                    {result.companyResearch.conversation_hook}
                  </p>
                </div>
              )}

              {result.companyResearch.candidate_connection && (
                <div className="p-2.5 bg-paper rounded border border-ink/10">
                  <span className="text-[11px] font-semibold text-ink/60 uppercase block mb-0.5">
                    Candidate Connection
                  </span>
                  <p className="text-xs text-ink/80 leading-relaxed">
                    {result.companyResearch.candidate_connection}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PART 3: Interview Talking Points */}
          {Array.isArray(result.companyResearch.interview_points) &&
            result.companyResearch.interview_points.length > 0 && (
              <div className="flex flex-col gap-2 pt-3 border-t border-moss/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-wide font-semibold text-moss flex items-center gap-1.5">
                    <span>💡</span> Interview Talking Points & Strategic Questions:
                  </h3>
                  <span className="text-[10px] font-mono text-ink/40">Ready for calls</span>
                </div>
                <div className="flex flex-col gap-2">
                  {result.companyResearch.interview_points.map((item, i) => {
                    if (typeof item === 'string') {
                      return (
                        <div
                          key={i}
                          className="p-2.5 bg-paper rounded border border-ink/10 text-xs text-ink/80 leading-relaxed"
                        >
                          <span className="font-semibold text-ink block mb-0.5">Point {i + 1}</span>
                          {item}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={i}
                        className="p-2.5 bg-paper rounded border border-ink/10 flex flex-col gap-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-moss/10 text-moss font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-semibold text-xs text-ink">
                            {item.point || 'Interview Angle'}
                          </span>
                        </div>
                        {item.context && (
                          <p className="text-xs text-ink/80 leading-relaxed pl-7">
                            {item.context}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </section>
      )}

      <section className="card mb-4">
        <p className="text-xs uppercase tracking-wide text-ink/40 font-medium mb-2">Email</p>
        <label className="block mb-2">
          <span className="text-[11px] text-ink/50 uppercase">Subject line</span>
          <input
            className="input-field font-medium mt-1"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            onBlur={persist}
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-ink/50 uppercase">Email body</span>
          <textarea
            className="input-field min-h-40 mt-1"
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            onBlur={persist}
          />
        </label>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => copy(`${emailSubject}\n\n${emailBody}`, 'Email')}
          >
            Copy email
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => share(`${emailSubject}\n\n${emailBody}`, 'Email')}
          >
            Share
          </button>
        </div>
      </section>

      <section className="card mb-6">
        <p className="text-xs uppercase tracking-wide text-ink/40 font-medium mb-2">
          LinkedIn Message (under 300 chars)
        </p>
        <textarea
          className="input-field min-h-24"
          value={linkedinMessage}
          onChange={(e) => setLinkedinMessage(e.target.value)}
          onBlur={persist}
        />
        <div className="flex items-center justify-between mt-1 text-[11px] text-ink/50 font-mono">
          <span>{linkedinMessage.length} / 300 characters</span>
          {linkedinMessage.length > 300 && (
            <span className="text-rust font-sans font-medium">Exceeds LinkedIn note limit</span>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => copy(linkedinMessage, 'LinkedIn message')}
          >
            Copy LinkedIn note
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => share(linkedinMessage, 'LinkedIn message')}
          >
            Share
          </button>
        </div>
      </section>

      <button
        type="button"
        className="btn-primary w-full"
        onClick={() => {
          clear();
          router.push('/generate');
        }}
      >
        Draft another message
      </button>
    </div>
  );
}
