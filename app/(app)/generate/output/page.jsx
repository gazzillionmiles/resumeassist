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
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500 text-xs">
        <div className="w-4 h-4 border-2 border-[#2CB7A5] border-t-transparent rounded-full animate-spin mr-2" />
        <span>Loading output…</span>
      </div>
    );
  }

  return <OutputClient result={result} />;
}
