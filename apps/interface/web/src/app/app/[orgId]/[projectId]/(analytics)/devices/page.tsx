'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useAnalyticsDevices } from '@/hooks/use-analytics-devices';
import { ChartCard } from '@/components/dashboard/chart-card';
import { PageHeader } from '@/components/dashboard/page-header';

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
];

const tooltipStyle = {
  backgroundColor: 'var(--color-popover)',
  borderColor: 'var(--color-border)',
  borderRadius: '8px',
  fontSize: '12px',
};

function DevicesContent() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading } = useAnalyticsDevices(projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Devices & Browsers" />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Device Types - Donut */}
        <ChartCard title="Device Types" isLoading={isLoading}>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data?.deviceTypes?.map((d) => ({ name: d.value || '(unknown)', value: d.count })) ?? []}
                cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                dataKey="value" nameKey="name"
                animationDuration={750}
              >
                {data?.deviceTypes?.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Browsers - Horizontal Bar */}
        <ChartCard title="Browsers" isLoading={isLoading}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.browsers?.slice(0, 8) ?? []} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis type="category" dataKey="value" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" width={60} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* OS - Horizontal Bar */}
        <ChartCard title="Operating Systems" isLoading={isLoading}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.operatingSystems?.slice(0, 8) ?? []} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis type="category" dataKey="value" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" width={60} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--color-chart-5)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  return <Suspense><DevicesContent /></Suspense>;
}
