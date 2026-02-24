'use client';

import { usePageView } from '@/hooks/use-analytics';

export function AuthPageTracker() {
  usePageView();
  return null;
}
