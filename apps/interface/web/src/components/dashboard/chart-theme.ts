export const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
];

export const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-popover)',
  borderColor: 'var(--color-border)',
  borderRadius: '8px',
  fontSize: '12px',
};

export const axisStyle = {
  tick: { fontSize: 12 },
  stroke: 'var(--color-muted-foreground)',
};

export const gridStyle = {
  strokeDasharray: '3 3',
  stroke: 'var(--color-border)',
  strokeOpacity: 0.5,
};
