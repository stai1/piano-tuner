import { TUNED_TOLERANCE_CENTS } from '../tuning/thresholds';

const RANGE = 50;
const SWEEP = 70;

// Square-root scale: fine detail near zero, still readable out to ±50 cents.
function angle(cents: number): number {
  const c = Math.max(-RANGE, Math.min(RANGE, cents));
  return Math.sign(c) * Math.sqrt(Math.abs(c) / RANGE) * SWEEP;
}

function point(deg: number, r: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [150 + r * Math.cos(rad), 160 + r * Math.sin(rad)];
}

function arc(from: number, to: number, r: number): string {
  const [x1, y1] = point(from, r);
  const [x2, y2] = point(to, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
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

export function Gauge({ cents, dim }: { cents: number | null; dim?: boolean }) {
  const a = cents === null ? 0 : angle(cents);
  const zone = angle(TUNED_TOLERANCE_CENTS);
  return (
    <svg className={`gauge${dim || cents === null ? ' dim' : ''}`} viewBox="0 0 300 175" role="img" aria-label="Tuning gauge">
      <path d={arc(-SWEEP, SWEEP, 130)} fill="none" stroke="var(--border)" strokeWidth="14" strokeLinecap="round" />
      <path d={arc(-zone, zone, 130)} fill="none" stroke="var(--ok)" strokeWidth="14" />
      {TICKS.map((t) => {
        const [x1, y1] = point(angle(t), 112);
        const [x2, y2] = point(angle(t), t === 0 ? 100 : 106);
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={t === 0 ? 2 : 1} />;
      })}
      {LABELS.map((t) => {
        const [x, y] = point(angle(t), 88);
        return (
          <text key={t} x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {t > 0 ? `+${t}` : t}
          </text>
        );
      })}
      <g className="needle" style={{ transform: `rotate(${a}deg)` }}>
        <line x1="150" y1="160" x2="150" y2="34" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="150" cy="160" r="7" fill="var(--text)" />
    </svg>
  );
}
