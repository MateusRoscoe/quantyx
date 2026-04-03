'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: { value: number }[];
  color?: string;
  height?: number;
}

export function Sparkline({
  data,
  color = 'var(--color-primary)',
  height = 32,
}: SparklineProps) {
  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sparkFill-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sparkFill-${color})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
