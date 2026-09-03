'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Search, Plus, CheckCircle2, FileText, Trash2, Edit3, ExternalLink, Sparkles } from 'lucide-react';

const TONES = [
  { value: 'warm_professional', label: 'Warm & Professional' },
  { value: 'direct_concise', label: 'Direct & Concise' },
  { value: 'formal', label: 'Formal' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
];

export default function History() {
  const qc = useQueryClient();
  const { data: generations, isLoading } = useQuery({
    queryKey: ['generations'],
    queryFn: api.listGenerations,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'sent' | 'draft'
  const [toast, setToast] = useState(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    companyName: '',
    roleTitle: '',
    tone: 'warm_professional',
    emailSubject: '',
    emailBody: '',
    linkedinMessage: '',
    wasCopiedOrShared: false,
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload) => api.createGeneration(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generations'] });
      setIsCreateOpen(false);
      resetForm();
      showToast('Outreach logged successfully');
    },
    onError: (err) => {
      showToast(err.message || 'Failed to create record');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fields }) => api.patchGeneration(id, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generations'] });
      setEditingItem(null);
      resetForm();
      showToast('Updated successfully');
    },
    onError: (err) => {
      showToast(err.message || 'Failed to update record');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteGeneration(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generations'] });
      setDeletingItem(null);
      showToast('Record deleted');
    },
    onError: (err) => {
      showToast(err.message || 'Failed to delete record');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, wasCopiedOrShared }) =>
      api.patchGeneration(id, { wasCopiedOrShared }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generations'] });
      showToast('Status updated');
    },
  });

  const resetForm = () => {
    setFormData({
      companyName: '',
      roleTitle: '',
      tone: 'warm_professional',
      emailSubject: '',
      emailBody: '',
      linkedinMessage: '',
      wasCopiedOrShared: false,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEditModal = (item, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setEditingItem(item);
    setFormData({
      companyName: item.company_name || '',
      roleTitle: item.role_title || '',
      tone: item.tone || 'warm_professional',
      emailSubject: item.email_subject || '',
      emailBody: item.email_output || '',
      linkedinMessage: item.linkedin_output || '',
      wasCopiedOrShared: Boolean(item.was_copied_or_shared),
    });
  };

  const openDeleteModal = (item, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setDeletingItem(item);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.companyName.trim()) return;

    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        fields: {
          companyName: formData.companyName.trim(),
          roleTitle: formData.roleTitle.trim(),
          tone: formData.tone,
          emailSubject: formData.emailSubject,
          emailOutput: formData.emailBody,
          linkedinOutput: formData.linkedinMessage,
          wasCopiedOrShared: formData.wasCopiedOrShared,
        },
      });
    } else {
      createMutation.mutate({
        companyName: formData.companyName.trim(),
        roleTitle: formData.roleTitle.trim(),
        tone: formData.tone,
        emailSubject: formData.emailSubject,
        emailBody: formData.emailBody,
        linkedinMessage: formData.linkedinMessage,
        wasCopiedOrShared: formData.wasCopiedOrShared,
      });
    }
  };

  // Filter and search
  const filteredGenerations = useMemo(() => {
    const list = generations || [];
    return list.filter((g) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (g.company_name && g.company_name.toLowerCase().includes(q)) ||
        (g.role_title && g.role_title.toLowerCase().includes(q)) ||
        (g.email_subject && g.email_subject.toLowerCase().includes(q)) ||
        (g.email_output && g.email_output.toLowerCase().includes(q));

      if (!matchQuery) return false;

      if (statusFilter === 'sent') return Boolean(g.was_copied_or_shared);
      if (statusFilter === 'draft') return !g.was_copied_or_shared;
      return true;
    });
  }, [generations, searchQuery, statusFilter]);

  const totalCount = generations?.length || 0;
  const sentCount = (generations || []).filter((g) => g.was_copied_or_shared).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 bg-[#2CB7A5] text-[#121316] px-4 py-2 rounded-xl shadow-2xl text-xs font-bold font-mono z-50 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Outreach History</h1>
          <p className="text-xs text-zinc-400 mt-1">
            {totalCount} total drafted &middot; {sentCount} sent &middot; All records safely stored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-primary text-xs py-2 px-4 cursor-pointer"
            onClick={openCreateModal}
          >
            <Plus className="w-4 h-4" />
            <span>Log Outreach</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="input-field pl-10 text-xs py-2.5"
            placeholder="Search company, role, or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 self-start sm:self-auto">
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              statusFilter === 'all'
                ? 'bg-[#2CB7A5] text-[#121316] font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            onClick={() => setStatusFilter('all')}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              statusFilter === 'sent'
                ? 'bg-[#2CB7A5] text-[#121316] font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            onClick={() => setStatusFilter('sent')}
          >
            Sent ({sentCount})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              statusFilter === 'draft'
                ? 'bg-[#2CB7A5] text-[#121316] font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            onClick={() => setStatusFilter('draft')}
          >
            Drafts ({totalCount - sentCount})
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-zinc-500 text-xs">
          <div className="w-4 h-4 border-2 border-[#2CB7A5] border-t-transparent rounded-full animate-spin mr-2" />
          <span>Loading history...</span>
        </div>
      )}

      {/* Generations List */}
      <div className="space-y-3">
        {filteredGenerations.map((g) => (
          <div
            key={g.id}
            className="glass-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/10 hover:border-white/20 transition-all group"
          >
            <Link
              href={`/generate/output/${g.id}`}
              className="flex-1 min-w-0 pr-2 block cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-bold text-base text-white group-hover:text-[#2CB7A5] transition-colors">
                  {g.company_name || 'Unknown company'}
                </span>
                {g.was_copied_or_shared ? (
                  <span className="stamp">Sent</span>
                ) : (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">
                    Draft
                  </span>
                )}
                {g.generation_type === 'company_outreach' && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#2CB7A5]/10 text-[#2CB7A5] border border-[#2CB7A5]/20">
                    Company Outreach
                  </span>
                )}
                {g.fetch_status === 'manual_paste' && (
                  <span className="text-[10px] uppercase text-zinc-500 font-mono">Pasted JD</span>
                )}
                {g.fetch_status === 'manual_entry' && (
                  <span className="text-[10px] uppercase text-zinc-500 font-mono">Manual Log</span>
                )}
              </div>

              <p className="text-xs text-zinc-300 font-medium mb-1">{g.role_title || 'Target Role'}</p>

              {g.email_subject && (
                <p className="text-xs text-zinc-400 truncate max-w-lg">
                  <span className="text-zinc-500">Subject:</span> {g.email_subject}
                </p>
              )}

              <p className="text-[11px] text-zinc-500 mt-2 font-mono">
                {new Date(g.created_at).toLocaleDateString()} &middot;{' '}
                {g.tone ? g.tone.replace('_', ' ') : 'warm professional'}
              </p>
            </Link>

            {/* Row Actions */}
            <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 justify-end">
              <button
                type="button"
                className="text-xs font-medium px-3 py-1.5 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/10 transition-colors cursor-pointer"
                title={g.was_copied_or_shared ? 'Mark as Draft' : 'Mark as Sent'}
                onClick={() =>
                  toggleStatusMutation.mutate({
                    id: g.id,
                    wasCopiedOrShared: !g.was_copied_or_shared,
                  })
                }
              >
                {g.was_copied_or_shared ? 'Mark Draft' : 'Mark Sent'}
              </button>
              <button
                type="button"
                className="text-xs font-medium px-3 py-1.5 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1"
                onClick={(e) => openEditModal(g, e)}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <Link
                href={`/generate/output/${g.id}`}
                className="text-xs font-medium px-3 py-1.5 rounded-xl bg-[#2CB7A5]/15 text-[#2CB7A5] hover:bg-[#2CB7A5]/25 transition-colors flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View</span>
              </Link>
              <button
                type="button"
                className="text-xs font-medium p-1.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                onClick={(e) => openDeleteModal(g, e)}
                title="Delete record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {!isLoading && filteredGenerations.length === 0 && (
          <div className="glass-card text-center py-16 border border-dashed border-white/10 space-y-3">
            <p className="text-zinc-400 text-xs">
              {searchQuery || statusFilter !== 'all'
                ? 'No outreach records match your filter criteria.'
                : 'No drafted outreach yet.'}
            </p>
            <div className="flex justify-center gap-3">
              {(searchQuery || statusFilter !== 'all') && (
                <button
                  type="button"
                  className="btn-secondary text-xs py-2 px-4 cursor-pointer"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  Clear filters
                </button>
              )}
              <Link href="/generate" className="btn-primary text-xs py-2 px-4">
                Draft new outreach
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {(isCreateOpen || editingItem) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#18191D] text-white rounded-2xl shadow-2xl max-w-xl w-full border border-white/10 max-h-[90vh] flex flex-col my-auto animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-base font-bold text-white">
                {editingItem ? 'Edit Outreach Record' : 'Log New Outreach'}
              </h2>
              <button
                type="button"
                className="text-zinc-400 hover:text-white text-lg leading-none p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingItem(null);
                }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 overflow-y-auto flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase">
                    Company Name *
                  </span>
                  <input
                    required
                    className="input-field mt-1 text-xs py-2"
                    placeholder="e.g. Stripe, OpenAI, Acme Corp"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase">
                    Role Title
                  </span>
                  <input
                    className="input-field mt-1 text-xs py-2"
                    placeholder="e.g. Senior Product Manager"
                    value={formData.roleTitle}
                    onChange={(e) =>
                      setFormData({ ...formData, roleTitle: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase">Tone</span>
                  <select
                    className="input-field mt-1 text-xs py-2 bg-[#121316]"
                    value={formData.tone}
                    onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  >
                    {TONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block flex flex-col justify-end">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase mb-1">
                    Status
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="status-checkbox"
                      className="w-4 h-4 accent-[#2CB7A5] rounded cursor-pointer"
                      checked={formData.wasCopiedOrShared}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          wasCopiedOrShared: e.target.checked,
                        })
                      }
                    />
                    <label htmlFor="status-checkbox" className="text-xs text-zinc-300 font-medium cursor-pointer">
                      Mark as sent / copied
                    </label>
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Email Subject
                </span>
                <input
                  className="input-field mt-1 text-xs py-2"
                  placeholder="e.g. Product Strategy & Senior PM Role"
                  value={formData.emailSubject}
                  onChange={(e) =>
                    setFormData({ ...formData, emailSubject: e.target.value })
                  }
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase">Email Body</span>
                <textarea
                  className="input-field mt-1 text-xs min-h-28"
                  placeholder="Write or paste email draft..."
                  value={formData.emailBody}
                  onChange={(e) =>
                    setFormData({ ...formData, emailBody: e.target.value })
                  }
                />
              </label>

              <label className="block">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase">
                    LinkedIn Message (under 300 chars)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {formData.linkedinMessage.length} / 300
                  </span>
                </div>
                <textarea
                  className="input-field mt-1 text-xs min-h-20"
                  placeholder="Write or paste LinkedIn note..."
                  value={formData.linkedinMessage}
                  onChange={(e) =>
                    setFormData({ ...formData, linkedinMessage: e.target.value })
                  }
                />
              </label>

              <div className="flex gap-2 justify-end pt-3 border-t border-white/10 mt-2">
                <button
                  type="button"
                  className="btn-secondary text-xs py-2 px-4 cursor-pointer"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingItem(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !formData.companyName.trim() ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                  className="btn-primary text-xs py-2 px-5 cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingItem
                    ? 'Save Changes'
                    : 'Create Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18191D] text-white rounded-2xl shadow-2xl max-w-sm w-full border border-white/10 p-5 animate-fade-in space-y-4">
            <h3 className="text-base font-bold text-red-400">
              Delete Outreach Record
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to delete the record for{' '}
              <span className="font-semibold text-white">
                {deletingItem.company_name || 'this company'}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary text-xs py-2 px-3.5 cursor-pointer"
                onClick={() => setDeletingItem(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger text-xs py-2 px-4 cursor-pointer"
                onClick={() => deleteMutation.mutate(deletingItem.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
