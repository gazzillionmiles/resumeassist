'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';
import { analytics } from '@/lib/client/analytics';
import DeleteAccountModal from '@/components/DeleteAccountModal';
import { Upload, FileText, CheckCircle2, AlertTriangle, Trash2, Save, Sparkles } from 'lucide-react';

export default function Profile() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">
        <div className="w-4 h-4 border-2 border-[#2CB7A5] border-t-transparent rounded-full animate-spin mr-2" />
        <span>Loading profile…</span>
      </div>
    );
  }

  return <ProfileForm key={profile?.id || 'new'} profile={profile} />;
}

function ProfileForm({ profile }) {
  const qc = useQueryClient();
  const { updateUser } = useAuthStore();

  const [fields, setFields] = useState({
    current_title: profile?.current_title || '',
    location: profile?.location || '',
    current_ctc: profile?.current_ctc || '',
    expected_ctc: profile?.expected_ctc || '',
    notice_period: profile?.notice_period || '',
  });

  const [resumeConfidence, setResumeConfidence] = useState(
    profile?.resume_parse_confidence || null
  );
  const [resumeStructured, setResumeStructured] = useState(
    profile?.resume_structured || null
  );
  const [resumeFilename, setResumeFilename] = useState(
    profile?.resume_filename || ''
  );
  const [uploading, setUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Compute live completeness
  const hasResume = Boolean(resumeStructured || profile?.resume_structured || profile?.resume_filename || resumeFilename);
  const isComplete = Boolean(
    hasResume &&
    fields.current_title.trim() &&
    fields.location.trim() &&
    fields.current_ctc.trim() &&
    fields.expected_ctc.trim() &&
    fields.notice_period.trim()
  );

  const save = useMutation({
    mutationFn: () => api.saveProfile(fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      updateUser({ is_profile_complete: isComplete });
      setSaveMessage('Profile saved successfully!');
      setTimeout(() => setSaveMessage(null), 2500);
    },
  });

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = await api.uploadResume(file);
      setResumeStructured(r.structured);
      setResumeConfidence(r.confidence);
      setResumeFilename(file.name);
      analytics.resumeUploaded({ confidence: r.confidence });
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      alert(err.message || 'Failed to upload resume');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Your Profile</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Used to customize every outreach draft and align candidate credentials with company research.
          </p>
        </div>

        {/* Profile Completeness Pill */}
        <div
          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto ${
            isComplete
              ? 'bg-[#2CB7A5]/10 border-[#2CB7A5]/30 text-[#2CB7A5]'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}
        >
          {isComplete ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>100% Complete</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              <span>Incomplete Profile</span>
            </>
          )}
        </div>
      </div>

      {/* Incomplete Warning Callout if any field is missing */}
      {!isComplete && (
        <div className="border border-amber-500/30 bg-amber-500/10 rounded-2xl p-4 text-xs text-amber-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-200">Complete Profile Required</p>
            <p className="text-zinc-300">
              Please ensure your resume is uploaded and all core fields (Title, Location, Current CTC, Expected CTC, Notice Period) are filled to generate high-converting outreach.
            </p>
          </div>
        </div>
      )}

      {/* Resume Section */}
      <section className="glass-card p-5 sm:p-6 space-y-4 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 text-[#2CB7A5]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Resume Document</h2>
              <p className="text-xs text-zinc-400">PDF or DOCX (max 10MB)</p>
            </div>
          </div>
          <label className="btn-secondary text-xs py-2 px-3.5 cursor-pointer flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Parsing Resume…' : 'Upload Resume'}</span>
            <input type="file" accept=".pdf,.docx" className="hidden" onChange={upload} disabled={uploading} />
          </label>
        </div>

        {resumeConfidence === 'low' && (
          <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl p-3.5 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-300">Low-confidence parse</p>
              <p className="text-zinc-400 mt-0.5">Please check and complete the details below before drafting outreach.</p>
            </div>
          </div>
        )}

        {resumeStructured && (
          <div className="text-xs text-zinc-300 space-y-1.5 bg-black/40 border border-white/5 p-4 rounded-xl">
            <div className="flex items-center gap-1.5 text-[#2CB7A5] font-semibold mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Parsed Resume Details</span>
            </div>
            <p><span className="text-zinc-500">Name:</span> {resumeStructured.name || '—'}</p>
            <p><span className="text-zinc-500">Title:</span> {resumeStructured.title || '—'}</p>
            <p><span className="text-zinc-500">Skills:</span> {(resumeStructured.skills || []).join(', ') || '—'}</p>
          </div>
        )}
      </section>

      {/* Core Profile Details */}
      <section className="glass-card p-5 sm:p-6 space-y-5 border border-white/10">
        <h2 className="text-base font-semibold text-white">Core Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <TextField
            label="Current Title"
            placeholder="e.g. Senior Software Engineer"
            value={fields.current_title}
            onChange={(v) => setFields((f) => ({ ...f, current_title: v }))}
            full
          />
          <TextField
            label="Location & Work Preference"
            placeholder="e.g. San Francisco, CA or Remote"
            value={fields.location}
            onChange={(v) => setFields((f) => ({ ...f, location: v }))}
            full
          />
          <TextField
            label="Current CTC"
            placeholder="e.g. $140,000 / ₹25 LPA"
            value={fields.current_ctc}
            onChange={(v) => setFields((f) => ({ ...f, current_ctc: v }))}
          />
          <TextField
            label="Expected CTC"
            placeholder="e.g. $170,000 / ₹35 LPA"
            value={fields.expected_ctc}
            onChange={(v) => setFields((f) => ({ ...f, expected_ctc: v }))}
          />
          <TextField
            label="Notice Period / Availability"
            placeholder="e.g. Immediate / 30 Days"
            value={fields.notice_period}
            onChange={(v) => setFields((f) => ({ ...f, notice_period: v }))}
            full
          />
        </div>

        {saveMessage && (
          <div className="p-3 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 text-[#2CB7A5] text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{saveMessage}</span>
          </div>
        )}

        <button
          className="btn-primary w-full py-3 text-xs uppercase tracking-wider font-bold cursor-pointer"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          <Save className="w-4 h-4" />
          <span>{save.isPending ? 'Saving…' : 'Save Profile'}</span>
        </button>
      </section>

      {/* Danger Zone: DPDP Account Deletion */}
      <section className="rounded-2xl bg-red-950/20 border border-red-500/20 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-red-400">
          <Trash2 className="w-5 h-5" />
          <div>
            <h2 className="text-base font-semibold text-white">Danger Zone</h2>
            <p className="text-xs text-zinc-400">Manage account lifecycle and DPDP data erasure rights.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-red-500/15">
          <div className="text-xs text-zinc-400 space-y-0.5">
            <p className="font-semibold text-zinc-200">Delete Account &amp; Personal Data</p>
            <p className="text-zinc-500">30-day grace period applies before permanent purge of resume, history, and records.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="btn-danger text-xs py-2 px-4 cursor-pointer self-start sm:self-auto shrink-0"
          >
            Delete Account
          </button>
        </div>
      </section>

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}

function TextField({ label, placeholder, value, onChange, full }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? 'col-span-1 sm:col-span-2' : ''}`}>
      <span className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">{label}</span>
      <input
        className="input-field"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
