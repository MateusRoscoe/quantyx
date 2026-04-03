'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { DateRange as DayPickerDateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useDateRange, type PeriodPreset } from '@/hooks/use-date-range';
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

  function handlePreset(value: PeriodPreset) {
    setRange({ period: value });
  }

  function handleCalendarSelect(range: DayPickerDateRange | undefined) {
    if (range?.from && range?.to) {
      setRange({ from: range.from, to: range.to, period: 'custom' });
      setOpen(false);
    }
  }

  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border bg-background text-sm shadow-sm">
      {presets.map((p) => (
        <button
          key={p.value}
          onClick={() => handlePreset(p.value)}
          className={cn(
            'cursor-pointer px-3 py-1.5 text-xs transition-colors hover:bg-accent',
            period === p.value
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-muted-foreground',
          )}
        >
          {p.label}
        </button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex cursor-pointer items-center gap-1.5 border-l px-3 py-1.5 text-xs transition-colors hover:bg-accent',
              period === 'custom'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {period === 'custom'
              ? `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`
              : 'Custom'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={{ from, to }}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            defaultMonth={from}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
