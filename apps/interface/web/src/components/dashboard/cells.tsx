import type { CellContext } from '@tanstack/react-table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Convert an ISO 3166-1 alpha-2 or alpha-3 country code to a flag emoji.
 * Returns null if the code isn't a valid 2-letter code.
 */
function countryToFlag(code: string): string | null {
  // Handle alpha-3 by taking first 2 chars (rough but covers most cases)
  const c = code.length === 3 ? code.slice(0, 2).toUpperCase() : code.toUpperCase();
  if (c.length !== 2 || !/^[A-Z]{2}$/.test(c)) return null;
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
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
  return (
    <span className="text-sm">
      {new Date(getValue() as string).toLocaleDateString()}
    </span>
  );
}

export function DateTimeCell<T>({ getValue }: CellContext<T, unknown>) {
  return (
    <span className="text-sm">
      {new Date(getValue() as string).toLocaleString()}
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

export function CountryCell<T>({ getValue }: CellContext<T, unknown>) {
  const code = getValue() as string;
  if (!code) return <span className="text-muted-foreground">—</span>;

  const flag = countryToFlag(code);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default text-base">
          {flag ?? <span className="font-mono text-xs text-muted-foreground">{code}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{code}</p>
      </TooltipContent>
    </Tooltip>
  );
}
