'use client';

import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from './sparkline';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number; // percentage, e.g. 12.4 means +12.4%
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

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {Icon && <Icon className="h-4 w-4" />}
          {label}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {trend && trend.direction !== 'neutral' && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium',
                trend.direction === 'up'
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive',
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
        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-3">
            <Sparkline data={sparklineData} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-9 w-32" />
        <Skeleton className="mt-3 h-8 w-full" />
      </CardContent>
    </Card>
  );
}
