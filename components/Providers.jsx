'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { initAnalytics } from '@/lib/client/analytics';

export default function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    initAnalytics();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
