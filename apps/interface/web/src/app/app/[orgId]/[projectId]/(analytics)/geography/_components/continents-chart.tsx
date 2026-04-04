'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tooltipStyle, axisStyle, gridStyle } from '@/components/dashboard';

interface ContinentsChartProps {
  continents: { value: string; count: number }[];
}

export function ContinentsChart({ continents }: ContinentsChartProps) {
  const data = continents.map((c) => ({
    name: c.value || '(unknown)',
    count: c.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
        <CartesianGrid {...gridStyle} horizontal={false} />
        <XAxis type="number" {...axisStyle} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          {...axisStyle}
          tick={{ fontSize: 11 }}
          width={100}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar
          dataKey="count"
          fill="var(--color-chart-5)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
