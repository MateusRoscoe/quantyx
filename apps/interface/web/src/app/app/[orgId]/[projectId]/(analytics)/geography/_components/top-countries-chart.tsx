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
import { countryToFlag, countryName } from '@/lib/country';

interface TopCountriesChartProps {
  countries: { country: string; count: number; uniqueUsers: number }[];
}

export function TopCountriesChart({ countries }: TopCountriesChartProps) {
  const data = countries.slice(0, 10).map((c) => ({
    name: `${countryToFlag(c.country) ?? ''} ${countryName(c.country) ?? c.country}`,
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
        <Bar dataKey="count" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
