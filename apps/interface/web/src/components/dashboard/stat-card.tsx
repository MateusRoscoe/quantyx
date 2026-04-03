'use client';

import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from './sparkline';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  sparklineData?: { value: number }[];
  isLoading?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  sparklineData,
  isLoading,
}: StatCardProps) {
  if (isLoading) {
    return <StatCardSkeleton />;
  }

  const displayValue = typeof value === 'number' ? value.toLocaleString() : '0';

  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {displayValue}
            </span>
            {trend && trend.direction !== 'neutral' && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  trend.direction === 'up'
                    ? 'text-success'
                    : 'text-destructive',
                )}
              >
                {trend.direction === 'up' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(trend.value).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        {Icon && (
          <Icon className="h-8 w-8 shrink-0 text-muted-foreground/25" />
        )}
      </div>
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-2">
          <Sparkline data={sparklineData} />
        </div>
      )}
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="gap-0 p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-16" />
      <Skeleton className="mt-2 h-6 w-full" />
    </Card>
  );
}
