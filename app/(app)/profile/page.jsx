'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function Profile() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  if (isLoading) {
    return <div className="pt-4 text-ink/50 text-sm">Loading profile…</div>;
  }

  return <ProfileForm key={profile?.id || 'new'} profile={profile} />;
}

function ProfileForm({ profile }) {
  const qc = useQueryClient();

  const [fields, setFields] = useState({
    current_title: profile?.current_title || '',
    current_ctc: profile?.current_ctc || '',
    expected_ctc: profile?.expected_ctc || '',
    notice_period: profile?.notice_period || '',
    location: profile?.location || '',
    work_auth: profile?.work_auth || '',
  });

  const [resumeConfidence, setResumeConfidence] = useState(
    profile?.resume_parse_confidence || null
  );
  const [resumeStructured, setResumeStructured] = useState(
    profile?.resume_structured || null
  );
  const [uploading, setUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const save = useMutation({
    mutationFn: () => api.saveProfile(fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
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
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      alert(err.message || 'Failed to upload resume');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="pt-4">
      <h1 className="text-2xl mb-1">Your profile</h1>
      <p className="text-ink/60 mb-6">Used to tailor every message. Update any time.</p>

      <section className="card mb-4">
        <h2 className="text-lg mb-2">Resume</h2>
        <label className="btn-secondary inline-block cursor-pointer">
          {uploading ? 'Parsing…' : 'Upload resume (PDF or DOCX)'}
          <input type="file" accept=".pdf,.docx" className="hidden" onChange={upload} />
        </label>
        {resumeConfidence === 'low' && (
          <div className="mt-4 border border-rust/40 bg-rust/5 rounded-md p-3 text-sm">
            <p className="font-medium text-rust mb-1">Low-confidence parse</p>
            <p className="text-ink/70">Review the fields below before your first generation.</p>
          </div>
        )}
        {resumeStructured && (
          <div className="mt-4 text-sm text-ink/80 space-y-1 bg-paper/50 p-3 rounded">
            <p><b>Name:</b> {resumeStructured.name || '—'}</p>
            <p><b>Title:</b> {resumeStructured.title || '—'}</p>
            <p><b>Skills:</b> {(resumeStructured.skills || []).join(', ') || '—'}</p>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg mb-4">Core details</h2>
        <div className="grid grid-cols-2 gap-3 font-mono text-sm">
          <TextField
            label="Current title"
            value={fields.current_title}
            onChange={(v) => setFields((f) => ({ ...f, current_title: v }))}
            full
          />
          <TextField
            label="Location"
            value={fields.location}
            onChange={(v) => setFields((f) => ({ ...f, location: v }))}
            full
          />
          <TextField
            label="Current CTC"
            value={fields.current_ctc}
            onChange={(v) => setFields((f) => ({ ...f, current_ctc: v }))}
          />
          <TextField
            label="Expected CTC"
            value={fields.expected_ctc}
            onChange={(v) => setFields((f) => ({ ...f, expected_ctc: v }))}
          />
          <TextField
            label="Notice period"
            value={fields.notice_period}
            onChange={(v) => setFields((f) => ({ ...f, notice_period: v }))}
          />
          <TextField
            label="Work authorization"
            value={fields.work_auth}
            onChange={(v) => setFields((f) => ({ ...f, work_auth: v }))}
          />
        </div>

        {saveMessage && (
          <p className="text-moss text-xs mt-3 font-medium">{saveMessage}</p>
        )}

        <button
          className="btn-primary mt-5 w-full cursor-pointer"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save profile'}
        </button>
      </section>
    </div>
  );
}

function TextField({ label, value, onChange, full }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? 'col-span-2' : ''}`}>
      <span className="text-ink/50 uppercase text-[11px] tracking-wide">{label}</span>
      <input
        className="input-field font-body"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
