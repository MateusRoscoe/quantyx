'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QuantyxProvider } from '@quantyx/react-sdk/react';

const quantyxApiKey = process.env['NEXT_PUBLIC_QUANTYX_API_KEY'];
const quantyxConfig = quantyxApiKey
  ? {
      apiKey: quantyxApiKey,
      endpoint:
        process.env['NEXT_PUBLIC_QUANTYX_INGEST_URL'] ??
        'http://localhost:3000',
    }
  : null;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: false,
          },
        },
      }),
  );

  const content = quantyxConfig ? (
    <QuantyxProvider config={quantyxConfig}>{children}</QuantyxProvider>
  ) : (
    children
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          {content}
          <Toaster richColors />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
