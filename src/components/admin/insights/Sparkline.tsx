// Tiny inline trend line for KPI cards and metric tiles. Pure SVG with no
// interactivity, so it renders from server and client components alike.
// Flat-zero series draw a baseline instead of disappearing.
export function Sparkline({
  values,
  color,
  width = 64,
  height = 18,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 1 - (v / max) * (height - 2)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
