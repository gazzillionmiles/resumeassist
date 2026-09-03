'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/state/authStore';

export function DeleteAccountModal({ isOpen, onClose }) {
  const router = useRouter();
  const { updateUser } = useAuthStore();
  const [confirmInput, setConfirmInput] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmInput.trim() !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.deleteAccount('DELETE', reason.trim());
      updateUser({
        deletion_status: 'pending_deletion',
        scheduled_purge_at: res.scheduled_purge_at,
      });
      if (onClose) onClose();
      router.push('/account-deleted');
    } catch (err) {
      setError(err.message || 'Failed to request account deletion.');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-[#18191D] text-white p-6 sm:p-8 space-y-5 shadow-2xl relative my-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 text-red-400">
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Delete Your Account?</h2>
            <p className="text-xs text-zinc-400">30-day grace period applies before permanent deletion.</p>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="space-y-2 text-xs text-zinc-300 leading-relaxed bg-red-500/5 p-4 rounded-xl border border-red-500/15">
          <p className="font-semibold text-red-400">Important Information (DPDP Notice):</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-300">
            <li>You will have a <strong>30-day grace period</strong> to restore your account if you change your mind.</li>
            <li>After 30 days, your saved outreach history, playbook entries, and uploaded resumes will be <strong>permanently deleted</strong>.</li>
            <li>During the grace period, new outreach generation will be disabled until you restore the account.</li>
          </ul>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 block">
            Reason for leaving <span className="text-zinc-500 font-normal">(Optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell us why you are deleting your account..."
            className="w-full h-20 rounded-xl border border-white/10 bg-black/30 p-3 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 resize-none text-white placeholder:text-zinc-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 block">
            To confirm deletion, type <span className="text-red-400 font-mono font-bold">DELETE</span> below:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="Type DELETE"
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500 tracking-wider text-white placeholder:text-zinc-600"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-zinc-300 hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || confirmInput.trim() !== 'DELETE'}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-red-600 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Confirm Account Deletion</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteAccountModal;
