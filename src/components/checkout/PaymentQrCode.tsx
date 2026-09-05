import type { QrRows } from '@/lib/payments/qr-matrix';

// Renders a QR symbol as inline SVG from a pre-computed module grid.
// No hooks and no encoder, so it is safe in a server or a client tree, and the
// image needs no network request, no <img> host and no canvas.

export function PaymentQrCode({ rows, size = 208, label }: {
  rows: QrRows;
  /** Rendered edge length in px. The SVG scales, so this is only a hint. */
  size?: number;
  /** Accessible name. A QR is an image of a payment instruction, and a screen
   *  reader user needs to be told what it pays, not that it is a square. */
  label: string;
}) {
  if (!rows.length) return null;
  const n = rows.length;
  // One module of quiet zone on each side is the minimum a scanner needs.
  const quiet = 2;
  const box = n + quiet * 2;

  // Coalesce each row's dark modules into horizontal runs: a 45x45 symbol is
  // ~1,000 dark modules but only ~250 runs, which keeps the markup small.
  const runs: { x: number; y: number; w: number }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < n) {
      if (row[x] === '1') {
        let w = 1;
        while (x + w < n && row[x + w] === '1') w++;
        runs.push({ x, y, w });
        x += w;
      } else x++;
    }
  });

  return (
    <svg
      viewBox={`0 0 ${box} ${box}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      style={{ display: 'block', borderRadius: 8, background: '#fff' }}
      shapeRendering="crispEdges"
    >
      <rect width={box} height={box} fill="#fff" />
      <g fill="#111827">
        {runs.map((r, i) => (
          <rect key={i} x={r.x + quiet} y={r.y + quiet} width={r.w} height={1} />
        ))}
      </g>
    </svg>
  );
}
