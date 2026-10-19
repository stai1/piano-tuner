import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  HANDLE_KEYS,
  HANDLE_LABELS,
  MAX_OCTAVE_TYPE,
  MIN_OCTAVE_TYPE,
  STRETCH_PRESETS,
  computeCurve,
  curveCentsFromET,
  formatOctaveType,
  solveHandle,
  type OctaveTypes,
  type StretchPreset,
} from '../dsp/curve';
import { KEY_COUNT } from '../dsp/notes';

const W = 360;
const H = 220;
const PAD = { left: 30, right: 12, top: 12, bottom: 26 };
const RANGE = 80;

const x = (key: number) => PAD.left + (key / (KEY_COUNT - 1)) * (W - PAD.left - PAD.right);
const y = (c: number) => PAD.top + ((RANGE - Math.max(-RANGE, Math.min(RANGE, c))) / (2 * RANGE)) * (H - PAD.top - PAD.bottom);
const centsAt = (py: number) => RANGE - ((py - PAD.top) / (H - PAD.top - PAD.bottom)) * 2 * RANGE;

const PRESET_LABEL: Record<StretchPreset, string> = { narrow: 'Narrow', standard: 'Standard', wide: 'Wide' };

interface Props {
  b: Float64Array;
  a4Hz: number;
  value: OctaveTypes;
  onChange: (types: OctaveTypes) => void;
}

// The tuning curve (each key's target relative to plain equal temperament)
// with a draggable handle for the octave type at each anchor key.
export function CurveEditor({ b, a4Hz, value, onChange }: Props) {
  const [draft, setDraft] = useState<OctaveTypes | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const types = draft ?? value;
  const offsets = useMemo(() => curveCentsFromET(computeCurve(b, a4Hz, types)), [b, a4Hz, types]);

  const toCents = (e: PointerEvent) => {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return centsAt(pt.matrixTransform(el.getScreenCTM()!.inverse()).y);
  };

  const onDown = (i: number) => (e: PointerEvent<SVGElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(i);
    setDraft(types);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging === null || !draft) return;
    setDraft(solveHandle(b, a4Hz, draft, dragging, toCents(e)));
  };
  const onUp = () => {
    if (dragging !== null && draft) onChange(draft);
    setDragging(null);
    setDraft(null);
  };

  // Up/Down move the curve itself; the bass and temperament handles widen
  // octaves (move the curve down) as their octave type grows.
  const onKey = (i: number) => (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const sign = (e.key === 'ArrowUp' ? 1 : -1) * (i >= 3 ? 1 : -1);
    const next = value.slice() as OctaveTypes;
    next[i] = Math.round(Math.max(MIN_OCTAVE_TYPE, Math.min(MAX_OCTAVE_TYPE, next[i] + sign * 0.1)) * 10) / 10;
    onChange(next);
  };

  const preset = (Object.keys(STRETCH_PRESETS) as StretchPreset[]).find((p) =>
    STRETCH_PRESETS[p].every((m, i) => Math.abs(m - value[i]) < 1e-9),
  );
  const path = offsets.map((c, k) => `${k ? 'L' : 'M'} ${x(k).toFixed(1)} ${y(c).toFixed(1)}`).join(' ');

  return (
    <div className="stack">
      <svg
        ref={svg}
        className="chart curve-editor"
        viewBox={`0 0 ${W} ${H}`}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="group"
        aria-label="Tuning curve: target of each key in cents from equal temperament"
      >
        {[-60, -40, -20, 0, 20, 40, 60].map((c) => (
          <g key={c}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(c)} y2={y(c)} stroke="var(--border)" strokeWidth={c === 0 ? 1.5 : 0.75} />
            <text x={PAD.left - 4} y={y(c) + 3} fontSize="9" textAnchor="end" fill="var(--muted)">
              {c > 0 ? `+${c}` : c}
            </text>
          </g>
        ))}
        {[0, 12, 24, 36, 48, 60, 72, 84].map((k) => (
          <text key={k} x={x(k)} y={H - 8} fontSize="9" textAnchor="middle" fill="var(--muted)">
            A{(k + 9) / 12 | 0}
          </text>
        ))}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {HANDLE_KEYS.map((key, i) => (
          <g key={key} className="handle" onPointerDown={onDown(i)} onKeyDown={onKey(i)} tabIndex={0} role="slider"
            aria-label={`${HANDLE_LABELS[i]} octave type`} aria-valuetext={formatOctaveType(types[i])}
            aria-valuemin={MIN_OCTAVE_TYPE} aria-valuemax={MAX_OCTAVE_TYPE} aria-valuenow={types[i]}>
            <circle cx={x(key)} cy={y(offsets[key])} r="22" fill="transparent" />
            <circle cx={x(key)} cy={y(offsets[key])} r={dragging === i ? 10 : 8} fill="var(--surface)" stroke="var(--accent)" strokeWidth="3" />
          </g>
        ))}
      </svg>

      <table className="data small">
        <thead>
          <tr>
            <th>Handle</th>
            <th>Octaves</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {HANDLE_KEYS.map((key, i) => (
            <tr key={key}>
              <td>{HANDLE_LABELS[i]}</td>
              <td>{formatOctaveType(types[i])}</td>
              <td>
                {offsets[key] > 0 ? '+' : ''}
                {offsets[key].toFixed(1)}¢
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row">
        {(Object.keys(STRETCH_PRESETS) as StretchPreset[]).map((p) => (
          <button key={p} className={preset === p ? 'primary' : ''} aria-pressed={preset === p} onClick={() => onChange(STRETCH_PRESETS[p].slice() as OctaveTypes)}>
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>
    </div>
  );
}
