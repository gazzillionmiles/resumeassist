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

      {result.duplicateWarning && (
        <div className="border border-rust/40 bg-rust/5 rounded-md p-3 text-sm mb-4">
          <p className="text-rust font-medium">You already messaged this company</p>
          <p className="text-ink/70">
            Last outreach on{' '}
            {new Date(result.duplicateWarning.previousDate).toLocaleDateString()}.
          </p>
        </div>
      )}

      {result.companyResearch && (
        <section className="card mb-4 border border-moss/30 bg-moss/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wide text-moss font-semibold flex items-center gap-1.5">
              <span>✦</span> Company Intelligence & Research
            </p>
          </div>

          {result.companyResearch.conversation_hook && (
            <div className="mb-3 p-2.5 bg-paper rounded border border-ink/10">
              <span className="text-[11px] font-semibold text-ink/60 uppercase block mb-0.5">
                Conversation Hook
              </span>
              <p className="text-xs text-ink font-medium leading-relaxed">
                {result.companyResearch.conversation_hook}
              </p>
            </div>
          )}

          {result.companyResearch.candidate_connection && (
            <div className="mb-3">
              <span className="text-[11px] font-semibold text-ink/60 uppercase block mb-0.5">
                Candidate Connection
              </span>
              <p className="text-xs text-ink/80 leading-relaxed">
                {result.companyResearch.candidate_connection}
              </p>
            </div>
          )}

          {result.companyResearch.recent_developments?.length > 0 && (
            <div className="mb-3">
              <span className="text-[11px] font-semibold text-ink/60 uppercase block mb-1">
                Recent Developments
              </span>
              <ul className="text-xs text-ink/80 list-disc list-inside space-y-1">
                {result.companyResearch.recent_developments.map((dev, i) => (
                  <li key={i} className="leading-relaxed">
                    {dev}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.companyResearch.sources_used?.length > 0 && (
            <div className="pt-2 border-t border-ink/10 flex flex-wrap items-center gap-2 text-[11px] text-ink/50">
              <span className="font-medium">Sources:</span>
              {result.companyResearch.sources_used.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-moss hover:underline truncate max-w-[200px]"
                  title={source.title || source.url}
                >
                  {source.title || new URL(source.url).hostname}
                </a>
              ))}
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
