'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { subDays, format, parseISO, startOfDay } from 'date-fns';

export type PeriodPreset = '1d' | '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
  period: PeriodPreset;
}

function getPresetRange(period: PeriodPreset): { from: Date; to: Date } {
  const to = startOfDay(new Date());
  switch (period) {
    case '1d':
      return { from: to, to };
    case '7d':
      return { from: subDays(to, 6), to };
    case '30d':
      return { from: subDays(to, 29), to };
    case '90d':
      return { from: subDays(to, 89), to };
    default:
      return { from: subDays(to, 6), to };
  }
}

export function useDateRange(): DateRange & {
  setRange: (range: Partial<DateRange>) => void;
  fromStr: string;
  toStr: string;
} {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const range = useMemo(() => {
    const periodParam = searchParams.get('period') as PeriodPreset | null;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (periodParam && periodParam !== 'custom') {
      const preset = getPresetRange(periodParam);
      return { ...preset, period: periodParam };
    }

    if (fromParam && toParam) {
      return {
        from: parseISO(fromParam),
        to: parseISO(toParam),
        period: 'custom' as PeriodPreset,
      };
    }

    // Default: last 7 days
    const preset = getPresetRange('7d');
    return { ...preset, period: '7d' as PeriodPreset };
  }, [searchParams]);

  const setRange = useCallback(
    (update: Partial<DateRange>) => {
      const params = new URLSearchParams(searchParams.toString());

      if (update.period && update.period !== 'custom') {
        params.set('period', update.period);
        params.delete('from');
        params.delete('to');
      } else {
        const from = update.from ?? range.from;
        const to = update.to ?? range.to;
        params.set('from', format(from, 'yyyy-MM-dd'));
        params.set('to', format(to, 'yyyy-MM-dd'));
        params.set('period', 'custom');
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, range, router, pathname],
  );

  return {
    ...range,
    fromStr: format(range.from, 'yyyy-MM-dd'),
    toStr: format(range.to, 'yyyy-MM-dd'),
    setRange,
  };
}
