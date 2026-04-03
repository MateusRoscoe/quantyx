import type { CellContext } from '@tanstack/react-table';

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
