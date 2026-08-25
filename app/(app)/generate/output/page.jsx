'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGenerationStore } from '@/state/generationStore';
import OutputClient from '@/components/OutputClient';

export default function OutputPage() {
  const result = useGenerationStore((s) => s.result);
  const router = useRouter();

  useEffect(() => {
    if (!result) {
      router.replace('/generate');
    }
  }, [result, router]);

  if (!result) {
    return <div className="pt-4 text-ink/50 text-sm">Loading output…</div>;
  }

  return <OutputClient result={result} />;
}
