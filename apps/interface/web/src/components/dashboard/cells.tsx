import type { CellContext } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useTimezone } from '@/hooks/use-timezone';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BrowserIcon } from '@/lib/dimension-icons';
import { countryToFlag, countryName } from '@/lib/country';

export function TruncateWithTooltip({
  children,
  tooltip,
  className,
}: {
  children: ReactNode;
  tooltip: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`block truncate ${className ?? ''}`}>{children}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-80 break-all font-mono text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function MonoCell<T>({ getValue }: CellContext<T, unknown>) {
  return <span className="font-mono text-sm">{getValue() as string}</span>;
}

export function NumberCell<T>({ getValue }: CellContext<T, unknown>) {
  return (
    <span className="font-mono tabular-nums">
      {(getValue() as number).toLocaleString()}
    </span>
  );
}

export function DateCell<T>({ getValue }: CellContext<T, unknown>) {
  const { timezone } = useTimezone();
  return (
    <span className="text-sm">
      {new Date(getValue() as string).toLocaleDateString(undefined, {
        timeZone: timezone,
      })}
    </span>
  );
}

export function DateTimeCell<T>({ getValue }: CellContext<T, unknown>) {
  const { timezone } = useTimezone();
  return (
    <span className="text-sm">
      {new Date(getValue() as string).toLocaleString(undefined, {
        timeZone: timezone,
        year: '2-digit',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })}
    </span>
  );
}

export function TruncatedIdCell<T>({
  getValue,
  length = 12,
}: CellContext<T, unknown> & { length?: number }) {
  const value = getValue() as string;
  return (
    <span className="font-mono text-xs">
      {value ? `${value.slice(0, length)}...` : '(anonymous)'}
    </span>
  );
}

export function BrowserCell<T>({ getValue }: CellContext<T, unknown>) {
  const value = getValue() as string;
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <BrowserIcon browser={value} className="h-3.5 w-3.5" />
      {value}
    </span>
  );
}

export function CountryCell<T>({ getValue }: CellContext<T, unknown>) {
  const code = getValue() as string;
  if (!code) return <span className="text-muted-foreground">—</span>;

  const flag = countryToFlag(code);
  const name = countryName(code);

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {flag && <span>{flag}</span>}
      {name ?? code}
    </span>
  );
}
