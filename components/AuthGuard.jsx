'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/state/authStore';

export default function AuthGuard({ children }) {
  const { token, hydrated, hydrate } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (hydrated && !token) router.replace(`/login?next=${encodeURIComponent(pathname)}`); }, [hydrated, token, router, pathname]);
  if (!hydrated || !token) return <div className="min-h-screen flex items-center justify-center text-ink/50 text-sm">Loading…</div>;
  return children;
}
