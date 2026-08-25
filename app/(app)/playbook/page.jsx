'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
    <div className="pt-4">
      <h1 className="text-2xl mb-1">Your playbook</h1>
      <p className="text-ink/60 mb-6">
        Paste 2–3 outreach messages you&apos;ve sent before and liked. Matching your own voice makes
        the output sound like you.
      </p>

      <section className="card mb-4">
        <textarea
          className="input-field min-h-32"
          placeholder="Paste a past message here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="btn-primary mt-3 w-full"
          disabled={text.trim().length < 20 || add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? 'Saving…' : 'Add example'}
        </button>
      </section>

      {isLoading && <p className="text-ink/50 text-sm">Loading examples…</p>}

      <div className="flex flex-col gap-3">
        {(examples || []).map((ex) => (
          <div key={ex.id} className="card">
            <p className="text-sm whitespace-pre-wrap text-ink/80">{ex.example_text}</p>
            <button
              className="text-rust text-xs mt-2 font-medium hover:underline cursor-pointer"
              onClick={() => del.mutate(ex.id)}
            >
              Remove
            </button>
          </div>
        ))}
        {examples && examples.length === 0 && (
          <p className="text-ink/50 text-sm">No examples yet.</p>
        )}
      </div>
    </div>
  );
}
