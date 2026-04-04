'use client';

import { useParams } from 'next/navigation';
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { useAnalyticsDevices } from '@/hooks/use-analytics-devices';
import {
  ChartCard,
  PageHeader,
  CHART_COLORS,
  tooltipStyle,
  axisStyle,
  gridStyle,
} from '@/components/dashboard';

function HorizontalBarChart({
  data,
  color,
}: {
  data: { value: string; count: number }[];
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: 60 }}>
        <CartesianGrid {...gridStyle} horizontal={false} />
        <XAxis type="number" {...axisStyle} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="value"
          {...axisStyle}
          tick={{ fontSize: 11 }}
          width={60}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DevicesPage() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading } = useAnalyticsDevices(projectId);

  return (
    <div className="space-y-6">
      <PageHeader title="Devices & Browsers" />

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Device Types"
          isLoading={isLoading}
          isEmpty={!data?.deviceTypes?.length}
        >
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={
                  data?.deviceTypes?.map((d) => ({
                    name: d.value || '(unknown)',
                    value: d.count,
                  })) ?? []
                }
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
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

        <ChartCard
          title="Browsers"
          isLoading={isLoading}
          isEmpty={!data?.browsers?.length}
        >
          <HorizontalBarChart
            data={data?.browsers ?? []}
            color="var(--color-chart-2)"
          />
        </ChartCard>

        <ChartCard
          title="Operating Systems"
          isLoading={isLoading}
          isEmpty={!data?.operatingSystems?.length}
        >
          <HorizontalBarChart
            data={data?.operatingSystems ?? []}
            color="var(--color-chart-5)"
          />
        </ChartCard>
      </div>
    </div>
  );
}
