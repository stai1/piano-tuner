import { keyName } from '../dsp/notes';
import type { Check } from '../storage/schema';

// Bars per checked note: offset from the reference curve in cents.
export function CheckChart({ check }: { check: Check }) {
  const notes = check.notes;
  const values = notes.map((n) => n.cents ?? 0);
  const extent = Math.max(10, ...values.map(Math.abs));
  const scale = Math.ceil(extent / 10) * 10;
  const w = 320;
  const h = 150;
  const top = 12;
  const bottom = 24;
  const mid = top + (h - top - bottom) / 2;
  const half = (h - top - bottom) / 2;
  const slot = w / notes.length;
  const avgY = mid - (check.averageCents / scale) * half;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Offset of each checked note in cents">
        <line x1="0" x2={w} y1={mid} y2={mid} stroke="var(--border)" />
        <text x="2" y={top + 8} fontSize="9" fill="var(--muted)">
          +{scale}¢
        </text>
        <text x="2" y={h - bottom - 2} fontSize="9" fill="var(--muted)">
          −{scale}¢
        </text>
        <line x1="0" x2={w} y1={avgY} y2={avgY} stroke="var(--accent)" strokeDasharray="4 3" />
        {notes.map((n, i) => {
          const x = i * slot + slot * 0.25;
          const bw = slot * 0.5;
          if (n.cents === null) {
            return (
              <text key={n.key} x={x + bw / 2} y={mid + 4} fontSize="10" textAnchor="middle" fill="var(--muted)">
                –
              </text>
            );
          }
          const y = n.cents >= 0 ? mid - (n.cents / scale) * half : mid;
          const bh = Math.max(1, (Math.abs(n.cents) / scale) * half);
          return (
            <g key={n.key}>
              <rect x={x} y={y} width={bw} height={bh} rx="2" fill={Math.abs(n.cents) <= 5 ? 'var(--ok)' : 'var(--warn)'}>
                <title>
                  {keyName(n.key)}: {n.cents.toFixed(1)} cents
                </title>
              </rect>
            </g>
          );
        })}
        {notes.map((n, i) => (
          <text key={n.key} x={i * slot + slot / 2} y={h - 8} fontSize="10" textAnchor="middle" fill="var(--muted)">
            {keyName(n.key)}
          </text>
        ))}
      </svg>
      <figcaption className="small muted">
        Offset of each note from the target, in cents. The dashed line is the average ({formatCents(check.averageCents)}).
      </figcaption>
    </figure>
  );
}

export function formatCents(c: number): string {
  const v = Math.abs(c) < 0.05 ? 0 : c;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}¢`;
}
