'use client';

interface DayRevenue {
  date: string; // 'YYYY-MM-DD'
  revenue: number;
}

export function RevenueChart({ days }: { days: DayRevenue[] }) {
  if (days.length === 0) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
        No revenue data yet
      </div>
    );
  }

  const max = Math.max(...days.map(d => d.revenue), 1);
  const W = 600, H = 100, barW = Math.max(4, Math.floor((W - days.length) / days.length));
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {days.map((d, i) => {
          const x = i * (barW + 1);
          const barH = Math.max(2, (d.revenue / max) * H);
          const y = H - barH;
          const isLast = i === days.length - 1;
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={barW} height={barH} rx={2}
                fill={isLast ? '#C5286A' : '#fce7f3'}
              />
              {/* Show label only every ~7 days to avoid clutter */}
              {(i % 7 === 0 || isLast) && (
                <text x={x + barW / 2} y={H + 16} textAnchor="middle"
                  fontSize="9" fill="#9ca3af">
                  {d.date.slice(5)} {/* MM-DD */}
                </text>
              )}
              {/* Tooltip: show on last bar */}
              {isLast && d.revenue > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                  fontSize="9" fill="#C5286A" fontWeight="600">
                  {fmt(d.revenue)}
                </text>
              )}
            </g>
          );
        })}
        {/* Y-axis labels */}
        <text x={W - 2} y={10} textAnchor="end" fontSize="9" fill="#d1d5db">{fmt(max)}</text>
        <text x={W - 2} y={H / 2 + 4} textAnchor="end" fontSize="9" fill="#d1d5db">{fmt(Math.round(max / 2))}</text>
        {/* Gridlines */}
        <line x1={0} y1={0} x2={W} y2={0} stroke="#f3f4f6" strokeWidth={1} />
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#f3f4f6" strokeWidth={1} />
        <line x1={0} y1={H} x2={W} y2={H} stroke="#f3f4f6" strokeWidth={1} />
      </svg>
    </div>
  );
}
