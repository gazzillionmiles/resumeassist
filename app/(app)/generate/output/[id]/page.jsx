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
            generation_type: g.generation_type,
            companyName: g.company_name,
            selectedPerson: g.selected_person || null,
            targetPeople: g.target_people || null,
            emailSubject: g.email_subject,
            emailBody: g.email_output,
            linkedinMessage: g.linkedin_output,
            companyResearch: g.company_research || null,
            createdAt: g.created_at,
          })
        )
        .catch((e) => setError(e.message || 'Failed to load generation'));
    }
  }, [id]);

  if (error) {
    return (
      <div className="py-8">
        <div className="border border-red-500/30 bg-red-500/10 rounded-2xl p-4 text-xs text-red-400">
          <p className="font-semibold text-red-300">Notice</p>
          <p className="mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500 text-xs">
        <div className="w-4 h-4 border-2 border-[#2CB7A5] border-t-transparent rounded-full animate-spin mr-2" />
        <span>Loading drafted message…</span>
      </div>
    );
  }

  return <OutputClient result={result} />;
}
