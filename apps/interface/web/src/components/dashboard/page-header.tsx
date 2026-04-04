'use client';

import type { ReactNode } from 'react';
import { DateRangePicker } from './date-range-picker';
import { FilterBar } from './filter-bar';

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
  showDateRange?: boolean;
  showFilterBar?: boolean;
}

export function PageHeader({
  title,
  children,
  showDateRange = true,
  showFilterBar = true,
}: PageHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {showDateRange && <DateRangePicker />}
      </div>
      {showFilterBar && <FilterBar />}
      {children}
    </div>
  );
}
