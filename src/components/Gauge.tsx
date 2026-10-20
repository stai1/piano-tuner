import { TUNED_TOLERANCE_CENTS } from '../tuning/thresholds';

const RANGE = 50;
const W = 320;
const PAD = 14;
const TRACK_Y = 14;
const TRACK_H = 10;

// Square-root scale: fine detail near zero, still readable out to ±50 cents.
function position(cents: number): number {
  const c = Math.max(-RANGE, Math.min(RANGE, cents));
  const t = Math.sign(c) * Math.sqrt(Math.abs(c) / RANGE);
  return W / 2 + t * (W / 2 - PAD);
}

const TICKS = [-50, -20, -10, -5, -2, -1, 0, 1, 2, 5, 10, 20, 50];
const LABELS = [-50, -20, -5, 0, 5, 20, 50];

export function tone(cents: number | null): string {
  if (cents === null) return '';
  const a = Math.abs(cents);
  if (a <= TUNED_TOLERANCE_CENTS) return 'tone-ok';
  if (a <= 5) return 'tone-warn';
  return 'tone-danger';
}

// Horizontal tuning meter: flat to the left, sharp to the right.
export function Gauge({ cents, dim }: { cents: number | null; dim?: boolean }) {
  const x = position(cents ?? 0);
  const zone = position(TUNED_TOLERANCE_CENTS) - W / 2;
  return (
    <svg className={`gauge${dim || cents === null ? ' dim' : ''}`} viewBox={`0 0 ${W} 52`} role="img" aria-label="Tuning gauge">
      <rect x={PAD} y={TRACK_Y} width={W - 2 * PAD} height={TRACK_H} rx={TRACK_H / 2} fill="var(--border)" />
      <rect x={W / 2 - zone} y={TRACK_Y} width={2 * zone} height={TRACK_H} fill="var(--ok)" />
      {TICKS.map((t) => (
        <line
          key={t}
          x1={position(t)}
          x2={position(t)}
          y1={TRACK_Y + TRACK_H + 3}
          y2={TRACK_Y + TRACK_H + (t === 0 ? 10 : 6)}
          stroke="var(--muted)"
          strokeWidth={t === 0 ? 1.5 : 1}
        />
      ))}
      {LABELS.map((t) => (
        <text key={t} x={position(t)} y={50} textAnchor="middle" fontSize="10" fill="var(--muted)">
          {t > 0 ? `+${t}` : t}
        </text>
      ))}
      <g className="needle" style={{ transform: `translateX(${x - W / 2}px)` }}>
        <path d={`M ${W / 2 - 6} 2 L ${W / 2 + 6} 2 L ${W / 2} 10 Z`} fill="var(--text)" />
        <rect x={W / 2 - 1.5} y={4} width={3} height={TRACK_Y + TRACK_H - 2} rx={1.5} fill="var(--text)" />
      </g>
    </svg>
  );
}
