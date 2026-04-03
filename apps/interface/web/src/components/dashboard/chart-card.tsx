'use client';

import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  className?: string;
}

export function ChartCard({
  title,
  description,
  action,
  children,
  isLoading,
  isEmpty,
  className,
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && (
            <CardDescription className="mt-0.5">{description}</CardDescription>
          )}
        </div>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : isEmpty ? (
          <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
            <BarChart3 className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">No data for this period</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
