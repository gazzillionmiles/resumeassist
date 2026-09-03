'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';
import { analytics } from '@/lib/client/analytics';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  ShieldCheck,
  Check,
  Loader2,
} from 'lucide-react';

const NOTICE_PERIOD_PRESETS = ['Immediate', '15 Days', '30 Days', '60 Days', '90 Days'];

export default function OnboardingPage() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500 text-sm gap-3">
        <div className="w-5 h-5 border-2 border-[#2CB7A5] border-t-transparent rounded-full animate-spin" />
        <span>Loading setup…</span>
      </div>
    );
  }

  return <OnboardingWizard key={profile?.id || 'new'} profile={profile} />;
}

function OnboardingWizard({ profile }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { updateUser } = useAuthStore();

  const hasExistingResume = Boolean(profile?.resume_structured || profile?.resume_filename);
  const initialStep = profile?.is_complete ? 3 : hasExistingResume ? 2 : 1;
  const [step, setStep] = useState(initialStep);

  // Resume state
  const [resumeFilename, setResumeFilename] = useState(
    profile?.resume_filename || (profile?.resume_structured ? 'Uploaded Resume' : '')
  );
  const [resumeStructured, setResumeStructured] = useState(profile?.resume_structured || null);
  const [resumeConfidence, setResumeConfidence] = useState(profile?.resume_parse_confidence || null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Core profile fields (Note: work_auth is removed)
  const [fields, setFields] = useState({
    current_title: profile?.current_title || profile?.currentTitle || '',
    location: profile?.location || '',
    current_ctc: profile?.current_ctc || profile?.currentCtc || '',
    expected_ctc: profile?.expected_ctc || profile?.expectedCtc || '',
    notice_period: profile?.notice_period || profile?.noticePeriod || '',
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle Resume Upload
  async function handleFileUpload(file) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);

    try {
      const res = await api.uploadResume(file);
      setResumeFilename(file.name);
      setResumeStructured(res.structured);
      setResumeConfidence(res.confidence);

      // Auto-prefill fields if extracted from resume
      setFields((prev) => ({
        ...prev,
        current_title: prev.current_title || res.structured?.title || '',
        location: prev.location || res.structured?.location || '',
      }));

      analytics.resumeUploaded({ confidence: res.confidence, filename: file.name });
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      setUploadError(err.message || 'Failed to upload and parse resume. Please try a valid PDF or DOCX file.');
    } finally {
      setUploading(false);
    }
  }

  // Validate Step 2 (Core Details)
  function validateStep2() {
    const errors = {};
    if (!fields.current_title.trim()) errors.current_title = 'Current job title is required';
    if (!fields.location.trim()) errors.location = 'Location / work preference is required';
    if (!fields.current_ctc.trim()) errors.current_ctc = 'Current compensation is required';
    if (!fields.expected_ctc.trim()) errors.expected_ctc = 'Expected compensation is required';
    if (!fields.notice_period.trim()) errors.notice_period = 'Notice period / availability is required';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Final submission and profile activation
  const saveMutation = useMutation({
    mutationFn: () => api.saveProfile(fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      updateUser({ is_profile_complete: true });
      analytics.generationCompleted({ flow: 'onboarding_complete' });
      router.replace('/generate');
    },
    onError: (err) => {
      alert(err.message || 'Failed to save profile. Please try again.');
      setIsSubmitting(false);
    },
  });

  async function handleCompleteOnboarding() {
    if (!resumeStructured && !resumeFilename) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }
    setIsSubmitting(true);
    saveMutation.mutate();
  }

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 text-[#2CB7A5] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>New User Setup</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Complete Your Profile
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
          Outreach uses your verified background to factually ground all emails and LinkedIn messages. Set this up once to unlock instant personalized generation.
        </p>
      </div>

      {/* Step Tracker */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { num: 1, label: 'Resume Upload', icon: FileText, done: Boolean(resumeStructured || resumeFilename) },
          { num: 2, label: 'Core Details', icon: Briefcase, done: Boolean(fields.current_title && fields.location && fields.current_ctc && fields.expected_ctc && fields.notice_period) },
          { num: 3, label: 'Review & Activate', icon: ShieldCheck, done: Boolean((resumeStructured || resumeFilename) && fields.current_title && fields.location && fields.current_ctc && fields.expected_ctc && fields.notice_period) },
        ].map((item) => {
          const isActive = step === item.num;
          const isDone = item.done;

          return (
            <button
              key={item.num}
              type="button"
              onClick={() => {
                // Allow navigation to previous or accessible steps
                if (item.num === 1) setStep(1);
                else if (item.num === 2 && (resumeStructured || resumeFilename)) setStep(2);
                else if (item.num === 3 && (resumeStructured || resumeFilename) && validateStep2()) setStep(3);
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center gap-2.5 ${
                isActive
                  ? 'bg-[#2CB7A5]/10 border-[#2CB7A5]/40 text-white shadow-lg'
                  : isDone
                  ? 'bg-white/5 border-white/10 text-zinc-300 hover:border-white/20'
                  : 'bg-black/20 border-white/5 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  isActive
                    ? 'bg-[#2CB7A5] text-[#121316]'
                    : isDone
                    ? 'bg-[#2CB7A5]/20 text-[#2CB7A5]'
                    : 'bg-white/5 text-zinc-500'
                }`}
              >
                {isDone && !isActive ? <Check className="w-4 h-4" /> : item.num}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{item.label}</p>
                <p className="text-[10px] text-zinc-400 hidden sm:block">
                  {item.num === 1 ? 'PDF or DOCX' : item.num === 2 ? 'Title & CTC' : 'Final Step'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* STEP 1: RESUME UPLOAD */}
      {step === 1 && (
        <div className="glass-card p-6 sm:p-8 space-y-6 border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 text-[#2CB7A5]">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Step 1: Upload Your Resume</h2>
                <p className="text-xs text-zinc-400">PDF or DOCX (max 10MB). AI will extract your skills, roles, and achievements.</p>
              </div>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              uploading
                ? 'border-[#2CB7A5] bg-[#2CB7A5]/5'
                : resumeStructured || resumeFilename
                ? 'border-[#2CB7A5]/50 bg-[#2CB7A5]/5'
                : 'border-white/15 bg-white/[0.02] hover:border-[#2CB7A5]/40 hover:bg-white/[0.04]'
            }`}
          >
            {uploading ? (
              <div className="space-y-3 py-4">
                <Loader2 className="w-10 h-10 animate-spin text-[#2CB7A5] mx-auto" />
                <p className="text-sm font-semibold text-white">Parsing and structuring resume...</p>
                <p className="text-xs text-zinc-400">Extracting skills, experience, and key accomplishments with AI.</p>
              </div>
            ) : resumeStructured || resumeFilename ? (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#2CB7A5]/20 border border-[#2CB7A5]/40 flex items-center justify-center text-[#2CB7A5] mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{resumeFilename || 'Resume uploaded successfully'}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Resume parsed and stored securely.</p>
                </div>
                <label className="btn-secondary text-xs py-2 px-4 cursor-pointer inline-flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload a different resume</span>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files?.[0])}
                    disabled={uploading}
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Drag &amp; drop your resume here, or browse</p>
                  <p className="text-xs text-zinc-400 mt-1">Supports PDF, DOCX up to 10MB</p>
                </div>
                <label className="btn-primary text-xs py-2.5 px-5 cursor-pointer inline-flex items-center gap-2 font-bold uppercase tracking-wider">
                  <Upload className="w-4 h-4" />
                  <span>Choose Resume File</span>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files?.[0])}
                    disabled={uploading}
                  />
                </label>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Parsed Resume Details Card */}
          {resumeStructured && (
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2CB7A5] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Parsed Resume Information</span>
                </span>
                {resumeConfidence === 'low' && (
                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Low Confidence — Please review details</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-300">
                <div>
                  <span className="text-zinc-500">Candidate Name:</span>{' '}
                  <span className="font-semibold text-white">{resumeStructured.name || 'Not detected'}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Detected Title:</span>{' '}
                  <span className="font-semibold text-white">{resumeStructured.title || 'Not detected'}</span>
                </div>
              </div>

              {resumeStructured.skills && resumeStructured.skills.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1.5">
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Extracted Skills:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {resumeStructured.skills.slice(0, 12).map((skill, idx) => (
                      <span key={idx} className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300">
                        {skill}
                      </span>
                    ))}
                    {resumeStructured.skills.length > 12 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-zinc-500">
                        +{resumeStructured.skills.length - 12} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1 Actions */}
          <div className="flex items-center justify-end pt-4 border-t border-white/5">
            <button
              type="button"
              disabled={!resumeStructured && !resumeFilename}
              onClick={() => {
                if (resumeStructured || resumeFilename) {
                  setStep(2);
                }
              }}
              className="btn-primary py-2.5 px-6 text-xs uppercase tracking-wider font-bold cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <span>Continue to Core Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CORE PROFESSIONAL DETAILS */}
      {step === 2 && (
        <div className="glass-card p-6 sm:p-8 space-y-6 border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 text-[#2CB7A5]">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Step 2: Core Professional &amp; Salary Details</h2>
                <p className="text-xs text-zinc-400">All fields are required to align compensation pitches with company recruiters.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Current Title */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center justify-between">
                <span>Current / Most Recent Title *</span>
                {validationErrors.current_title && (
                  <span className="text-red-400 text-[11px] font-normal">{validationErrors.current_title}</span>
                )}
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  className={`input-field !pl-10 w-full ${validationErrors.current_title ? 'border-red-500/50' : ''}`}
                  placeholder="e.g. Senior Full Stack Engineer"
                  value={fields.current_title}
                  onChange={(e) => {
                    setFields((f) => ({ ...f, current_title: e.target.value }));
                    if (validationErrors.current_title) {
                      setValidationErrors((v) => ({ ...v, current_title: null }));
                    }
                  }}
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center justify-between">
                <span>Location &amp; Work Preference *</span>
                {validationErrors.location && (
                  <span className="text-red-400 text-[11px] font-normal">{validationErrors.location}</span>
                )}
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  className={`input-field !pl-10 w-full ${validationErrors.location ? 'border-red-500/50' : ''}`}
                  placeholder="e.g. San Francisco, CA (or Remote)"
                  value={fields.location}
                  onChange={(e) => {
                    setFields((f) => ({ ...f, location: e.target.value }));
                    if (validationErrors.location) {
                      setValidationErrors((v) => ({ ...v, location: null }));
                    }
                  }}
                />
              </div>
            </div>

            {/* CTC row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center justify-between">
                  <span>Current CTC / Compensation *</span>
                  {validationErrors.current_ctc && (
                    <span className="text-red-400 text-[11px] font-normal">{validationErrors.current_ctc}</span>
                  )}
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className={`input-field !pl-10 w-full ${validationErrors.current_ctc ? 'border-red-500/50' : ''}`}
                    placeholder="e.g. $140,000 / ₹25 LPA"
                    value={fields.current_ctc}
                    onChange={(e) => {
                      setFields((f) => ({ ...f, current_ctc: e.target.value }));
                      if (validationErrors.current_ctc) {
                        setValidationErrors((v) => ({ ...v, current_ctc: null }));
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center justify-between">
                  <span>Expected CTC / Target *</span>
                  {validationErrors.expected_ctc && (
                    <span className="text-red-400 text-[11px] font-normal">{validationErrors.expected_ctc}</span>
                  )}
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className={`input-field !pl-10 w-full ${validationErrors.expected_ctc ? 'border-red-500/50' : ''}`}
                    placeholder="e.g. $170,000 / ₹35 LPA"
                    value={fields.expected_ctc}
                    onChange={(e) => {
                      setFields((f) => ({ ...f, expected_ctc: e.target.value }));
                      if (validationErrors.expected_ctc) {
                        setValidationErrors((v) => ({ ...v, expected_ctc: null }));
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Notice Period */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center justify-between">
                <span>Notice Period / Joining Availability *</span>
                {validationErrors.notice_period && (
                  <span className="text-red-400 text-[11px] font-normal">{validationErrors.notice_period}</span>
                )}
              </label>
              <div className="relative mb-2">
                <Clock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  className={`input-field !pl-10 w-full ${validationErrors.notice_period ? 'border-red-500/50' : ''}`}
                  placeholder="e.g. Immediate / 30 Days"
                  value={fields.notice_period}
                  onChange={(e) => {
                    setFields((f) => ({ ...f, notice_period: e.target.value }));
                    if (validationErrors.notice_period) {
                      setValidationErrors((v) => ({ ...v, notice_period: null }));
                    }
                  }}
                />
              </div>

              {/* Quick Select Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Quick Select:</span>
                {NOTICE_PERIOD_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setFields((f) => ({ ...f, notice_period: preset }));
                      if (validationErrors.notice_period) {
                        setValidationErrors((v) => ({ ...v, notice_period: null }));
                      }
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      fields.notice_period === preset
                        ? 'bg-[#2CB7A5] text-[#121316] font-bold border-[#2CB7A5]'
                        : 'bg-white/5 text-zinc-400 border-white/10 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2 Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary py-2.5 px-4 text-xs font-semibold cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Resume</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (validateStep2()) {
                  setStep(3);
                }
              }}
              className="btn-primary py-2.5 px-6 text-xs uppercase tracking-wider font-bold cursor-pointer flex items-center gap-2 shadow-md"
            >
              <span>Review &amp; Confirm</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & ACTIVATE */}
      {step === 3 && (
        <div className="glass-card p-6 sm:p-8 space-y-6 border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 text-[#2CB7A5]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Step 3: Review &amp; Activate Profile</h2>
                <p className="text-xs text-zinc-400">Review your complete setup before starting your first outreach draft.</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 text-[#2CB7A5] text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>100% Ready</span>
            </div>
          </div>

          {/* Profile Overview Card */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <FileText className="w-4 h-4 text-[#2CB7A5]" />
                <span>Resume Document</span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[11px] text-[#2CB7A5] hover:underline font-semibold cursor-pointer"
              >
                Change Resume
              </button>
            </div>

            <div className="text-xs space-y-1.5 text-zinc-300">
              <p><span className="text-zinc-500">File:</span> {resumeFilename || 'Uploaded Resume'}</p>
              {resumeStructured?.name && (
                <p><span className="text-zinc-500">Candidate Name:</span> {resumeStructured.name}</p>
              )}
              {resumeStructured?.skills && resumeStructured.skills.length > 0 && (
                <p className="truncate">
                  <span className="text-zinc-500">Skills:</span> {resumeStructured.skills.slice(0, 8).join(', ')}...
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 pb-3 border-t border-b border-white/5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Briefcase className="w-4 h-4 text-[#2CB7A5]" />
                <span>Professional Details</span>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-[11px] text-[#2CB7A5] hover:underline font-semibold cursor-pointer"
              >
                Edit Details
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-300">
              <div>
                <span className="text-zinc-500">Current Title:</span>{' '}
                <span className="font-semibold text-white">{fields.current_title}</span>
              </div>
              <div>
                <span className="text-zinc-500">Location:</span>{' '}
                <span className="font-semibold text-white">{fields.location}</span>
              </div>
              <div>
                <span className="text-zinc-500">Current CTC:</span>{' '}
                <span className="font-semibold text-white">{fields.current_ctc}</span>
              </div>
              <div>
                <span className="text-zinc-500">Expected CTC:</span>{' '}
                <span className="font-semibold text-white">{fields.expected_ctc}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-zinc-500">Notice Period:</span>{' '}
                <span className="font-semibold text-white">{fields.notice_period}</span>
              </div>
            </div>
          </div>

          {/* Value callout */}
          <div className="p-4 rounded-xl bg-[#2CB7A5]/5 border border-[#2CB7A5]/20 text-xs text-zinc-300 space-y-1">
            <p className="font-semibold text-[#2CB7A5] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tailored Outreach Ready</span>
            </p>
            <p className="text-zinc-400">
              You receive 5 free full-pipeline outreach generations with live company research, recruiter intelligence, and DPDP privacy compliance.
            </p>
          </div>

          {/* Step 3 Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="btn-secondary w-full sm:w-auto py-3 px-4 text-xs font-semibold cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Edit</span>
            </button>
            <button
              type="button"
              disabled={isSubmitting || saveMutation.isPending}
              onClick={handleCompleteOnboarding}
              className="btn-primary w-full sm:w-auto py-3 px-8 text-xs uppercase tracking-wider font-bold cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isSubmitting || saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activating Profile…</span>
                </>
              ) : (
                <>
                  <span>Activate Profile &amp; Start Outreach</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
