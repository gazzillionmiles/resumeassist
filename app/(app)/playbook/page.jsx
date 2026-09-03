'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BookOpen, Plus, Trash2, Sparkles } from 'lucide-react';

export default function Playbook() {
  const qc = useQueryClient();
  const { data: examples, isLoading } = useQuery({
    queryKey: ['playbook'],
    queryFn: api.listPlaybook,
  });

  const [text, setText] = useState('');

  const add = useMutation({
    mutationFn: () => api.addPlaybookExample(text),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['playbook'] });
    },
  });

  const del = useMutation({
    mutationFn: api.deletePlaybookExample,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playbook'] }),
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Your Playbook</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Paste 2–3 outreach messages you&apos;ve sent before and liked. Matching your tone makes generated drafts sound authentically like you.
        </p>
      </div>

      <section className="glass-card p-5 sm:p-6 space-y-4 border border-white/10">
        <div className="flex items-center gap-2 text-zinc-300 text-xs font-semibold">
          <BookOpen className="w-4 h-4 text-[#2CB7A5]" />
          <span>Add Style Example</span>
        </div>
        <textarea
          className="input-field min-h-32 text-xs"
          placeholder="Paste a past message, email, or LinkedIn note that performed well…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
          disabled={text.trim().length < 20 || add.isPending}
          onClick={() => add.mutate()}
        >
          <Plus className="w-4 h-4" />
          <span>{add.isPending ? 'Saving Example…' : 'Add Example to Playbook'}</span>
        </button>
      </section>

      {isLoading && (
        <div className="flex items-center justify-center py-10 text-zinc-500 text-xs">
          <div className="w-4 h-4 border-2 border-[#2CB7A5] border-t-transparent rounded-full animate-spin mr-2" />
          <span>Loading examples…</span>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Saved Playbook Examples ({(examples || []).length})</h2>
        {(examples || []).map((ex, index) => (
          <div key={ex.id} className="glass-card p-4 sm:p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-mono text-[11px] text-[#2CB7A5]">Example #{index + 1}</span>
              <button
                className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                onClick={() => del.mutate(ex.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
            <p className="text-xs whitespace-pre-wrap text-zinc-200 leading-relaxed bg-black/30 p-3.5 rounded-xl border border-white/5 font-mono">
              {ex.example_text}
            </p>
          </div>
        ))}
        {examples && examples.length === 0 && (
          <div className="glass-card text-center py-10 text-xs text-zinc-500 border border-dashed border-white/10">
            No playbook examples yet. Add examples above to guide the AI voice model.
          </div>
        )}
      </div>
    </div>
  );
}
