'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useGenerationStore } from '@/state/generationStore';
import {
  Sparkles,
  Search,
  Target,
  Lightbulb,
  Mail,
  MessageSquare,
  Copy,
  Share2,
  Check,
  ExternalLink,
  PlusCircle,
  UserCheck,
} from 'lucide-react';

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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Toast Notification */}
      {note && (
        <div className="fixed top-4 right-4 bg-[#2CB7A5] text-[#121316] px-4 py-2 rounded-xl shadow-2xl text-xs font-bold font-mono z-50 animate-fade-in flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>{note}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Ready to Send</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Grounded company intel synthesized. Edit anything below, then copy or share directly.
          </p>
        </div>
        <span className="stamp">Drafted</span>
      </div>

      {/* Target Recipient Card (for Company Outreach) */}
      {(result.selectedPerson || result.selected_person) && (() => {
        const p = result.selectedPerson || result.selected_person;
        return (
          <section className="glass-card p-5 sm:p-6 space-y-3 border border-white/15 bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-200 text-xs font-bold uppercase tracking-wider">
                <UserCheck className="w-4 h-4 text-[#2CB7A5]" />
                <span>Target Recipient</span>
              </div>
              {p.profile_url && (
                <a
                  href={p.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2CB7A5] hover:underline text-xs inline-flex items-center gap-1 font-medium"
                >
                  <span>View LinkedIn Profile</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="p-4 bg-black/40 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-white">{p.name}</h3>
                <p className="text-xs text-[#2CB7A5] font-medium mt-0.5">{p.title || 'Talent Acquisition'}</p>
                {p.relevance_reason && (
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    <span className="text-zinc-500 font-semibold">Why Relevant: </span>
                    {p.relevance_reason}
                  </p>
                )}
              </div>
              {p.location && (
                <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 self-start sm:self-auto shrink-0">
                  {p.location}
                </span>
              )}
            </div>
          </section>
        );
      })()}

      {/* SECTION 1: Grounded Company Research & Intel */}
      {result.companyResearch && (
        <section className="glass-card p-5 sm:p-6 space-y-6 border border-[#2CB7A5]/30 bg-[#2CB7A5]/5">
          <div className="flex items-center justify-between border-b border-[#2CB7A5]/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 flex items-center justify-center text-[#2CB7A5]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#2CB7A5] uppercase tracking-wider font-bold">
                  ✦ Grounded Intel
                </span>
                <h2 className="text-base font-bold text-white">
                  {result.companyResearch.company_name || result.company_name || 'Target Company'}
                </h2>
              </div>
            </div>
            <span className="stamp">Verified Intel</span>
          </div>

          {/* PART 1: Here is what Outreach found about this company */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#2CB7A5]" />
              <span>Here is what Outreach found about this company:</span>
            </h3>

            {/* Recent Developments */}
            {Array.isArray(result.companyResearch.recent_developments) &&
              result.companyResearch.recent_developments.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide block">
                    Recent Developments &amp; News
                  </span>
                  <div className="space-y-2">
                    {result.companyResearch.recent_developments.map((dev, i) => {
                      if (typeof dev === 'string') {
                        return (
                          <div
                            key={i}
                            className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs text-zinc-300 leading-relaxed"
                          >
                            {dev}
                          </div>
                        );
                      }
                      return (
                        <div
                          key={i}
                          className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-white">
                              {dev.headline || 'Development'}
                            </span>
                            {dev.date && (
                              <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                                {dev.date}
                              </span>
                            )}
                          </div>
                          {dev.summary && (
                            <p className="text-xs text-zinc-400 leading-relaxed">
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
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-0.5">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase block">
                  Why it is relevant to this role
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {result.companyResearch.relevance}
                </p>
              </div>
            )}

            {/* Sources used */}
            {Array.isArray(result.companyResearch.sources_used) &&
              result.companyResearch.sources_used.length > 0 && (
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                  <span className="font-semibold text-zinc-300">Sources:</span>
                  {result.companyResearch.sources_used.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#2CB7A5] hover:underline truncate max-w-[220px] inline-flex items-center gap-1"
                      title={source.title || source.url}
                    >
                      <span>{source.title || (source.url ? new URL(source.url).hostname : 'Source')}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
          </div>

          {/* PART 2: Here is how this research was used in your outreach */}
          {(result.companyResearch.conversation_hook ||
            result.companyResearch.candidate_connection) && (
            <div className="space-y-3 pt-3 border-t border-[#2CB7A5]/20">
              <h3 className="text-xs font-bold text-[#2CB7A5] uppercase tracking-wider flex items-center gap-2">
                <Target className="w-3.5 h-3.5" />
                <span>Here is how this research was used in your outreach:</span>
              </h3>

              {result.companyResearch.conversation_hook && (
                <div className="p-3.5 bg-black/40 rounded-xl border border-[#2CB7A5]/30 space-y-1">
                  <span className="text-[11px] font-bold text-[#2CB7A5] uppercase block">
                    Conversation / Personalization Hook
                  </span>
                  <p className="text-xs text-white font-medium leading-relaxed">
                    {result.companyResearch.conversation_hook}
                  </p>
                </div>
              )}

              {result.companyResearch.candidate_connection && (
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase block">
                    Candidate Connection &amp; Background Alignment
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {result.companyResearch.candidate_connection}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PART 3: Interview Talking Points */}
          {Array.isArray(result.companyResearch.interview_points) &&
            result.companyResearch.interview_points.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-[#2CB7A5]/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#2CB7A5] uppercase tracking-wider flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Interview Talking Points &amp; Strategic Questions:</span>
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">Ready for calls</span>
                </div>
                <div className="space-y-2">
                  {result.companyResearch.interview_points.map((item, i) => {
                    if (typeof item === 'string') {
                      return (
                        <div
                          key={i}
                          className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs text-zinc-300 leading-relaxed"
                        >
                          <span className="font-semibold text-white block mb-0.5">Point {i + 1}</span>
                          {item}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={i}
                        className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-lg bg-[#2CB7A5]/10 text-[#2CB7A5] font-mono text-[10px] font-bold flex items-center justify-center shrink-0 border border-[#2CB7A5]/20">
                            {i + 1}
                          </span>
                          <span className="font-semibold text-xs text-white">
                            {item.point || 'Interview Angle'}
                          </span>
                        </div>
                        {item.context && (
                          <p className="text-xs text-zinc-400 leading-relaxed pl-7">
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

      {/* SECTION 2: Email Draft */}
      <section className="glass-card p-5 sm:p-6 space-y-4 border border-white/10">
        <div className="flex items-center gap-2 text-zinc-200 text-xs font-bold uppercase tracking-wider">
          <Mail className="w-4 h-4 text-[#2CB7A5]" />
          <span>Email Outreach</span>
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase">Subject line</span>
          <input
            className="input-field text-xs font-semibold"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            onBlur={persist}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase">Email body</span>
          <textarea
            className="input-field min-h-44 text-xs leading-relaxed"
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            onBlur={persist}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="btn-secondary flex-1 py-2.5 text-xs font-semibold cursor-pointer"
            onClick={() => copy(`${emailSubject}\n\n${emailBody}`, 'Email')}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Email</span>
          </button>
          <button
            type="button"
            className="btn-secondary flex-1 py-2.5 text-xs font-semibold cursor-pointer"
            onClick={() => share(`${emailSubject}\n\n${emailBody}`, 'Email')}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </section>

      {/* SECTION 3: LinkedIn Note Draft */}
      <section className="glass-card p-5 sm:p-6 space-y-4 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-200 text-xs font-bold uppercase tracking-wider">
            <MessageSquare className="w-4 h-4 text-[#2CB7A5]" />
            <span>LinkedIn Note</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">Max 300 chars</span>
        </div>

        <div className="space-y-1.5">
          <textarea
            className="input-field min-h-24 text-xs leading-relaxed"
            value={linkedinMessage}
            onChange={(e) => setLinkedinMessage(e.target.value)}
            onBlur={persist}
          />
          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span>{linkedinMessage.length} / 300 characters</span>
            {linkedinMessage.length > 300 && (
              <span className="text-red-400 font-sans font-medium">Exceeds 300 character limit</span>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="btn-secondary flex-1 py-2.5 text-xs font-semibold cursor-pointer"
            onClick={() => copy(linkedinMessage, 'LinkedIn note')}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Note</span>
          </button>
          <button
            type="button"
            className="btn-secondary flex-1 py-2.5 text-xs font-semibold cursor-pointer"
            onClick={() => share(linkedinMessage, 'LinkedIn note')}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </section>

      {/* Action Footer */}
      <button
        type="button"
        className="btn-primary w-full py-3.5 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg flex items-center justify-center gap-2"
        onClick={() => {
          clear();
          router.push('/generate');
        }}
      >
        <PlusCircle className="w-4 h-4" />
        <span>Draft Another Outreach Message</span>
      </button>
    </div>
  );
}
