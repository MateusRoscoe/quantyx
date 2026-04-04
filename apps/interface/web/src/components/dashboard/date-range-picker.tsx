'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { DateRange as DayPickerDateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { useDateRange, type PeriodPreset } from '@/hooks/use-date-range';
import { useTimezone } from '@/hooks/use-timezone';
import { cn } from '@/lib/utils';

const presets: { label: string; value: PeriodPreset }[] = [
  { label: 'Today', value: '1d' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
];

export function DateRangePicker() {
  const { from, to, period, setRange } = useDateRange();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayPickerDateRange | undefined>();
  const draftRef = useRef(draft);
  const containerRef = useRef<HTMLDivElement>(null);
  const clickCount = useRef(0);

  // Keep ref in sync
  draftRef.current = draft;

  function commitAndClose() {
    const d = draftRef.current;
    if (d?.from) {
      setRange({ from: d.from, to: d.to ?? d.from, period: 'custom' });
    }
    setOpen(false);
    clickCount.current = 0;
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        commitAndClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handlePreset(value: PeriodPreset) {
    setRange({ period: value });
    setOpen(false);
    clickCount.current = 0;
  }

  function toggleOpen() {
    if (open) {
      commitAndClose();
    } else {
      setDraft({ from, to });
      clickCount.current = 0;
      setOpen(true);
    }
  }

  function handleCalendarSelect(range: DayPickerDateRange | undefined) {
    clickCount.current += 1;

    if (clickCount.current === 1) {
      // First click always starts a fresh range — figure out which date was clicked
      // because rdp may have adjusted the existing range instead of resetting it
      const prev = draftRef.current;
      const fromChanged =
        !prev?.from ||
        !range?.from ||
        range.from.getTime() !== prev.from.getTime();
      const clickedDate = fromChanged ? range?.from : range?.to;
      setDraft({ from: clickedDate, to: undefined });
      return;
    }

    setDraft(range);
    if (range?.from && range?.to) {
      setRange({ from: range.from, to: range.to, period: 'custom' });
      setOpen(false);
      clickCount.current = 0;
    }
  }

  const { abbreviation: tzAbbr } = useTimezone();

  return (
    <div className="relative flex items-center gap-2" ref={containerRef}>
      <div className="inline-flex items-center overflow-hidden rounded-md border bg-background text-sm shadow-sm">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={cn(
              'cursor-pointer px-3 py-1.5 text-xs transition-colors hover:bg-accent',
              period === p.value
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'text-muted-foreground'
            )}
          >
            {p.label}
          </button>
        ))}

        <button
          onClick={toggleOpen}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 border-l px-3 py-1.5 text-xs transition-colors hover:bg-accent',
            period === 'custom'
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {period === 'custom'
            ? `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`
            : 'Custom'}
        </button>
      </div>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 rounded-md border bg-popover shadow-md">
          <Calendar
            mode="range"
            showOutsideDays={true}
            selected={draft}
            onSelect={handleCalendarSelect}
            numberOfMonths={1}
            defaultMonth={draft?.from ?? from}
          />
        </div>
      )}
      <span className="text-xs text-muted-foreground">{tzAbbr}</span>
    </div>
  );
}
