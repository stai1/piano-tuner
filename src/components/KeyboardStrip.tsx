import { KEY_COUNT, isBlackKey, keyName } from '../dsp/notes';

interface Props {
  current?: number | null;
  done?: ReadonlySet<number>;
  marked?: ReadonlySet<number>;
  onSelect?: (key: number) => void;
}

const WHITE_W = 10;
const WHITE_H = 56;
const BLACK_W = 6;
const BLACK_H = 34;

// Black keys sit off-center over the gap between white keys, as on a real
// keyboard: C♯ and F♯ lean left, D♯ and A♯ lean right. Index is semitones
// above A (A♯ = 1, C♯ = 4, D♯ = 6, F♯ = 9, G♯ = 11).
const BLACK_SHIFT: Record<number, number> = { 1: 0.15, 4: -0.15, 6: 0.15, 9: -0.2, 11: 0 };

interface KeyShape {
  key: number;
  x: number;
  black: boolean;
}

// White keys take the full width; black keys are drawn on top.
const SHAPES: KeyShape[] = (() => {
  const out: KeyShape[] = [];
  let whites = 0;
  for (let k = 0; k < KEY_COUNT; k++) {
    if (isBlackKey(k)) {
      const shift = BLACK_SHIFT[k % 12] ?? 0;
      out.push({ key: k, x: whites * WHITE_W - BLACK_W / 2 + shift * WHITE_W, black: true });
    } else {
      out.push({ key: k, x: whites * WHITE_W, black: false });
      whites++;
    }
  }
  return out;
})();
const WIDTH = SHAPES.filter((s) => !s.black).length * WHITE_W;
const WHITES = SHAPES.filter((s) => !s.black);
const BLACKS = SHAPES.filter((s) => s.black);

// All 88 keys, colored by state. Tapping a key selects it.
export function KeyboardStrip({ current, done, marked, onSelect }: Props) {
  const fill = (s: KeyShape) => {
    if (done?.has(s.key)) return 'var(--ok)';
    if (marked?.has(s.key)) return 'var(--warn)';
    return s.black ? 'var(--key-black)' : 'var(--key-white)';
  };
  const render = (s: KeyShape) => (
    <rect
      key={s.key}
      x={s.x + (s.black ? 0 : 0.5)}
      y={0}
      width={s.black ? BLACK_W : WHITE_W - 1}
      height={s.black ? BLACK_H : WHITE_H}
      rx={s.black ? 1 : 1.5}
      fill={fill(s)}
      stroke={s.black ? 'none' : 'var(--border)'}
      strokeWidth={0.75}
      vectorEffect="non-scaling-stroke"
      role={onSelect ? 'button' : undefined}
      aria-label={keyName(s.key)}
      aria-pressed={onSelect ? current === s.key : undefined}
      onClick={onSelect ? () => onSelect(s.key) : undefined}
      style={onSelect ? { cursor: 'pointer' } : undefined}
    />
  );
  const cur = current === null || current === undefined ? null : SHAPES[current];

  return (
    <div>
      <svg className="keys" viewBox={`0 0 ${WIDTH} ${WHITE_H}`} preserveAspectRatio="none" role="group" aria-label="Piano keyboard">
        {WHITES.map(render)}
        {BLACKS.map(render)}
        {cur ? (
          <rect
            x={cur.x + (cur.black ? 0 : 0.5)}
            y={0.75}
            width={cur.black ? BLACK_W : WHITE_W - 1}
            height={(cur.black ? BLACK_H : WHITE_H) - 1.5}
            rx={1.5}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ) : null}
      </svg>
      <div className="keys-labels" aria-hidden="true">
        <span style={{ left: 0 }}>A0</span>
        <span style={{ left: `${((SHAPES[39].x + WHITE_W / 2) / WIDTH) * 100}%` }}>C4</span>
        <span style={{ left: '100%' }}>C8</span>
      </div>
    </div>
  );
}
