'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { subDays, addDays } from 'date-fns';
import { useTimezone } from './use-timezone';

export type PeriodPreset = '1d' | '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  from: Date;
  to: Date; // inclusive display day (toStr adds +1 day for exclusive API upper bound)
  period: PeriodPreset;
}

function toUTCString(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}

/**
 * Get today's date in the given IANA timezone, returned as a local Date at midnight.
 */
function getTodayInTz(tz: string): Date {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getPresetRange(period: PeriodPreset, tz: string): { from: Date; to: Date } {
  const today = getTodayInTz(tz);
  switch (period) {
    case '1d':
      return { from: today, to: today };
    case '7d':
      return { from: subDays(today, 6), to: today };
    case '30d':
      return { from: subDays(today, 29), to: today };
    case '90d':
      return { from: subDays(today, 89), to: today };
    default:
      return { from: subDays(today, 6), to: today };
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
  const { timezone } = useTimezone();

  const range = useMemo(() => {
    const periodParam = searchParams.get('period') as PeriodPreset | null;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (periodParam && periodParam !== 'custom') {
      return { ...getPresetRange(periodParam, timezone), period: periodParam };
    }

    if (fromParam && toParam) {
      return {
        from: new Date(fromParam),
        to: new Date(toParam),
        period: 'custom' as PeriodPreset,
      };
    }

    return { ...getPresetRange('7d', timezone), period: '7d' as PeriodPreset };
  }, [searchParams, timezone]);

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
        params.set('from', from.toISOString());
        params.set('to', to.toISOString());
        params.set('period', 'custom');
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, range, router, pathname],
  );

  const fromUTC = toUTCString(range.from);
  const toUTC = toUTCString(addDays(range.to, 1));

  return {
    ...range,
    fromStr: fromUTC,
    toStr: toUTC,
    setRange,
  };
}
