'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import OutputClient from '@/components/OutputClient';

export default function HistoryOutput() {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      api
        .getGeneration(id)
        .then((g) =>
          setResult({
            generationId: g.id,
            emailSubject: g.email_subject,
            emailBody: g.email_output,
            linkedinMessage: g.linkedin_output,
            companyResearch: g.company_research || null,
            createdAt: g.created_at,
            duplicateWarning: null,
          })
        )
        .catch((e) => setError(e.message || 'Failed to load generation'));
    }
  }, [id]);

  if (error) {
    return (
      <div className="pt-4">
        <div className="border border-rust/40 bg-rust/5 rounded-md p-3 text-sm text-rust">
          {error}
        </div>
      </div>
    );
  }

  if (!result) {
    return <div className="pt-4 text-ink/50 text-sm">Loading drafted message…</div>;
  }

  return <OutputClient result={result} />;
}
