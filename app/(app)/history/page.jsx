'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function History() {
  const { data: generations, isLoading } = useQuery({
    queryKey: ['generations'],
    queryFn: api.listGenerations,
  });

  return (
    <div className="pt-4">
      <h1 className="text-2xl mb-1">History</h1>
      <p className="text-ink/60 mb-6">Every message you&apos;ve drafted, tagged by company.</p>

      {isLoading && <p className="text-ink/50 text-sm">Loading…</p>}

      <div className="flex flex-col gap-3">
        {(generations || []).map((g) => (
          <Link
            href={`/generate/output/${g.id}`}
            key={g.id}
            className="card flex items-center justify-between hover:border-ink/20 transition-all"
          >
            <div>
              <p className="font-medium">{g.company_name || 'Unknown company'}</p>
              <p className="text-sm text-ink/60">{g.role_title || '—'}</p>
              <p className="text-xs text-ink/40 mt-1">
                {new Date(g.created_at).toLocaleDateString()} · {g.tone?.replace('_', '-')}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {g.fetch_status === 'manual_paste' && (
                <span className="text-[10px] uppercase text-ink/40 font-mono">Manual paste</span>
              )}
              {g.was_copied_or_shared && <span className="stamp">Sent</span>}
            </div>
          </Link>
        ))}
        {generations && generations.length === 0 && (
          <p className="text-ink/50 text-sm">No generations yet — go draft your first one.</p>
        )}
      </div>
    </div>
  );
}
