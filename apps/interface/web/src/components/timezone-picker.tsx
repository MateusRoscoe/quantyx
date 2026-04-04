'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useTimezone } from '@/hooks/use-timezone';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Mexico_City',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

// Get all IANA timezone names supported by the browser
function getAllTimezones(): string[] {
  try {
    return (
      Intl as unknown as { supportedValuesOf: (key: string) => string[] }
    ).supportedValuesOf('timeZone');
  } catch {
    return COMMON_TIMEZONES;
  }
}

function formatTzLabel(tz: string): string {
  const offset =
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ?? '';

  return `${tz.replace(/_/g, ' ')} (${offset})`;
}

export function TimezonePicker() {
  const { timezone, abbreviation, setTimezone } = useTimezone();
  const [open, setOpen] = useState(false);

  const allTz = getAllTimezones();
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SidebarMenuButton className="cursor-pointer">
          <Globe className="h-4 w-4" />
          <span>{abbreviation}</span>
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        className="w-72 p-0"
        sideOffset={8}
      >
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup heading="Browser default">
              <CommandItem
                value={browserTz}
                onSelect={() => {
                  setTimezone(browserTz);
                  setOpen(false);
                }}
              >
                {formatTzLabel(browserTz)}
                {timezone === browserTz && (
                  <span className="ml-auto text-xs text-primary">Active</span>
                )}
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Common">
              {COMMON_TIMEZONES.filter((tz) => tz !== browserTz).map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  onSelect={() => {
                    setTimezone(tz);
                    setOpen(false);
                  }}
                >
                  {formatTzLabel(tz)}
                  {timezone === tz && (
                    <span className="ml-auto text-xs text-primary">Active</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="All timezones">
              {allTz
                .filter(
                  (tz) => !COMMON_TIMEZONES.includes(tz) && tz !== browserTz,
                )
                .map((tz) => (
                  <CommandItem
                    key={tz}
                    value={tz}
                    onSelect={() => {
                      setTimezone(tz);
                      setOpen(false);
                    }}
                  >
                    {formatTzLabel(tz)}
                    {timezone === tz && (
                      <span className="ml-auto text-xs text-primary">
                        Active
                      </span>
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
