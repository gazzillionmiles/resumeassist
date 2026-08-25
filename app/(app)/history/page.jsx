'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';

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
    <div className="pt-4 max-w-4xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 bg-ink text-paper px-4 py-2 rounded-md shadow-lg text-xs font-mono z-50 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display mb-1">History</h1>
          <p className="text-ink/60 text-sm">
            {totalCount} total drafted &middot; {sentCount} sent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5"
            onClick={openCreateModal}
          >
            <span>+</span> Log Outreach
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            className="input-field py-2 text-sm"
            placeholder="Search company, role, or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-paperRaised border border-ink/10 rounded-md p-1 self-start sm:self-auto">
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              statusFilter === 'all'
                ? 'bg-ink text-paper font-medium'
                : 'text-ink/60 hover:text-ink'
            }`}
            onClick={() => setStatusFilter('all')}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              statusFilter === 'sent'
                ? 'bg-moss text-paper font-medium'
                : 'text-ink/60 hover:text-ink'
            }`}
            onClick={() => setStatusFilter('sent')}
          >
            Sent ({sentCount})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              statusFilter === 'draft'
                ? 'bg-ink/70 text-paper font-medium'
                : 'text-ink/60 hover:text-ink'
            }`}
            onClick={() => setStatusFilter('draft')}
          >
            Drafts ({totalCount - sentCount})
          </button>
        </div>
      </div>

      {isLoading && <p className="text-ink/50 text-sm py-8 text-center">Loading history...</p>}

      {/* Generations List */}
      <div className="flex flex-col gap-3">
        {filteredGenerations.map((g) => (
          <div
            key={g.id}
            className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-ink/20 transition-all group"
          >
            <Link
              href={`/generate/output/${g.id}`}
              className="flex-1 min-w-0 pr-2 block cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-base text-ink group-hover:text-moss transition-colors">
                  {g.company_name || 'Unknown company'}
                </span>
                {g.was_copied_or_shared ? (
                  <span className="stamp">Sent</span>
                ) : (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-ink/5 text-ink/50 border border-ink/10">
                    Draft
                  </span>
                )}
                {g.fetch_status === 'manual_paste' && (
                  <span className="text-[10px] uppercase text-ink/40 font-mono">Pasted JD</span>
                )}
                {g.fetch_status === 'manual_entry' && (
                  <span className="text-[10px] uppercase text-ink/40 font-mono">Manual Log</span>
                )}
              </div>

              <p className="text-sm text-ink/70 mb-1 font-medium">{g.role_title || 'Target Role'}</p>

              {g.email_subject && (
                <p className="text-xs text-ink/50 truncate max-w-md">
                  <span className="font-medium text-ink/60">Subject:</span> {g.email_subject}
                </p>
              )}

              <p className="text-[11px] text-ink/40 mt-2">
                {new Date(g.created_at).toLocaleDateString()} &middot;{' '}
                {g.tone ? g.tone.replace('_', ' ') : 'warm professional'}
              </p>
            </Link>

            {/* Row Actions */}
            <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-ink/5 justify-end">
              <button
                type="button"
                className="text-xs font-medium px-2.5 py-1.5 rounded border border-ink/15 text-ink/70 hover:bg-ink/5 transition-colors"
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
                className="text-xs font-medium px-2.5 py-1.5 rounded border border-ink/15 text-ink hover:bg-ink/5 transition-colors"
                onClick={(e) => openEditModal(g, e)}
              >
                Edit
              </button>
              <Link
                href={`/generate/output/${g.id}`}
                className="text-xs font-medium px-2.5 py-1.5 rounded bg-moss/10 text-moss hover:bg-moss/20 transition-colors"
              >
                View
              </Link>
              <button
                type="button"
                className="text-xs font-medium px-2.5 py-1.5 rounded text-rust hover:bg-rust/10 transition-colors"
                onClick={(e) => openDeleteModal(g, e)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {!isLoading && filteredGenerations.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-ink/60 text-sm mb-3">
              {searchQuery || statusFilter !== 'all'
                ? 'No outreach records match your filter.'
                : 'No drafted outreach yet.'}
            </p>
            <div className="flex justify-center gap-3">
              {(searchQuery || statusFilter !== 'all') && (
                <button
                  type="button"
                  className="btn-secondary text-xs py-2"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  Clear filters
                </button>
              )}
              <Link href="/generate" className="btn-primary text-xs py-2">
                Draft new outreach
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {(isCreateOpen || editingItem) && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-paperRaised rounded-lg shadow-xl max-w-xl w-full border border-ink/15 max-h-[90vh] flex flex-col my-auto animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-ink/10">
              <h2 className="text-lg font-display font-semibold">
                {editingItem ? 'Edit Outreach Record' : 'Log New Outreach'}
              </h2>
              <button
                type="button"
                className="text-ink/40 hover:text-ink text-xl leading-none"
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
                  <span className="text-[11px] font-semibold text-ink/60 uppercase">
                    Company Name *
                  </span>
                  <input
                    required
                    className="input-field mt-1 text-sm py-2"
                    placeholder="e.g. Stripe, Acme Corp"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold text-ink/60 uppercase">
                    Role Title
                  </span>
                  <input
                    className="input-field mt-1 text-sm py-2"
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
                  <span className="text-[11px] font-semibold text-ink/60 uppercase">Tone</span>
                  <select
                    className="input-field mt-1 text-sm py-2"
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
                  <span className="text-[11px] font-semibold text-ink/60 uppercase mb-1">
                    Status
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="status-checkbox"
                      className="w-4 h-4 accent-moss rounded"
                      checked={formData.wasCopiedOrShared}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          wasCopiedOrShared: e.target.checked,
                        })
                      }
                    />
                    <label htmlFor="status-checkbox" className="text-xs text-ink/80 font-medium">
                      Mark as sent / copied
                    </label>
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] font-semibold text-ink/60 uppercase">
                  Email Subject
                </span>
                <input
                  className="input-field mt-1 text-sm py-2"
                  placeholder="e.g. Product Strategy & Senior PM Role"
                  value={formData.emailSubject}
                  onChange={(e) =>
                    setFormData({ ...formData, emailSubject: e.target.value })
                  }
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-ink/60 uppercase">Email Body</span>
                <textarea
                  className="input-field mt-1 text-sm min-h-28"
                  placeholder="Write or paste email draft..."
                  value={formData.emailBody}
                  onChange={(e) =>
                    setFormData({ ...formData, emailBody: e.target.value })
                  }
                />
              </label>

              <label className="block">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-ink/60 uppercase">
                    LinkedIn Message (under 300 chars)
                  </span>
                  <span className="text-[10px] text-ink/40 font-mono">
                    {formData.linkedinMessage.length} / 300
                  </span>
                </div>
                <textarea
                  className="input-field mt-1 text-sm min-h-20"
                  placeholder="Write or paste LinkedIn note..."
                  value={formData.linkedinMessage}
                  onChange={(e) =>
                    setFormData({ ...formData, linkedinMessage: e.target.value })
                  }
                />
              </label>

              <div className="flex gap-2 justify-end pt-3 border-t border-ink/10 mt-2">
                <button
                  type="button"
                  className="btn-secondary text-xs py-2 px-4"
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
                  className="btn-primary text-xs py-2 px-5"
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
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperRaised rounded-lg shadow-xl max-w-sm w-full border border-ink/15 p-5 animate-fade-in">
            <h3 className="text-base font-display font-semibold mb-2 text-rust">
              Delete Outreach Record
            </h3>
            <p className="text-xs text-ink/70 mb-4 leading-relaxed">
              Are you sure you want to delete the record for{' '}
              <span className="font-semibold text-ink">
                {deletingItem.company_name || 'this company'}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary text-xs py-2 px-3"
                onClick={() => setDeletingItem(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-rust hover:bg-rust/90 text-paper text-xs font-semibold px-4 py-2 rounded-md transition-colors disabled:opacity-50"
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
