import { A4_KEY, DEFAULT_A4_HZ, KEY_COUNT, cents, etFrequency, partialFrequency, shiftCents } from './notes';

export interface TuningCurve {
  // Target fundamental parameter per key (partial n at n * f0 * sqrt(1 + B n^2)).
  f0: Float64Array;
  b: Float64Array;
  a4Hz: number;
}

// Octave type m means the lower note's partial 2m is matched to the upper
// note's partial m (1 = 2:1 octaves, 2 = 4:2, 3 = 6:3); larger m stretches
// octaves wider. A curve is set by m at five handles: A0, F♯2, the A3–A4
// temperament octave, C7 and C8. Between handles m changes linearly, and
// fractional values blend the two neighboring octave types.
export type OctaveTypes = [number, number, number, number, number];

// Keys where the handles are shown on the curve (the temperament octave's
// handle sits on A3, the key it sets).
export const HANDLE_KEYS = [0, 21, 36, 75, 87] as const;
export const HANDLE_LABELS = ['A0', 'F♯2', 'A3–A4', 'C7', 'C8'] as const;
export const MIN_OCTAVE_TYPE = 1;
export const MAX_OCTAVE_TYPE = 6;

export type StretchPreset = 'narrow' | 'standard' | 'wide';

export const STRETCH_PRESETS: Record<StretchPreset, OctaveTypes> = {
  narrow: [3, 2, 1, 1, 1],
  // 4:2 in the temperament octave, easing to 2:1 by C7, widening to 6:3 by
  // F♯2 and 8:4 at A0.
  standard: [4, 3, 2, 1, 1],
  wide: [5, 4, 3, 1.5, 1.5],
};

function interp(key: number, k0: number, m0: number, k1: number, m1: number): number {
  return m0 + ((m1 - m0) * (key - k0)) / (k1 - k0);
}

export function octaveType(key: number, t: OctaveTypes): number {
  const [a0, fs2, temperament, c7, c8] = t;
  if (key > A4_KEY) return key <= 75 ? interp(key, A4_KEY + 1, temperament, 75, c7) : interp(key, 75, c7, 87, c8);
  if (key < A4_KEY - 12) return key >= 21 ? interp(key, A4_KEY - 12, temperament, 21, fs2) : interp(key, 21, fs2, 0, a0);
  return temperament;
}

export function formatOctaveType(m: number): string {
  const r = (x: number) => String(Math.round(x * 10) / 10);
  return `${r(2 * m)}:${r(m)}`;
}

function matchUpper(lowerF0: number, lowerB: number, upperB: number, m: number): number {
  const lo = Math.floor(m);
  const hi = Math.ceil(m);
  const solve = (t: number) => partialFrequency(lowerF0, 2 * t, lowerB) / (t * Math.sqrt(1 + upperB * t * t));
  if (lo === hi) return solve(lo);
  const w = m - lo;
  return Math.exp((1 - w) * Math.log(solve(lo)) + w * Math.log(solve(hi)));
}

function matchLower(upperF0: number, upperB: number, lowerB: number, m: number): number {
  const lo = Math.floor(m);
  const hi = Math.ceil(m);
  const solve = (t: number) => partialFrequency(upperF0, t, upperB) / (2 * t * Math.sqrt(1 + lowerB * 4 * t * t));
  if (lo === hi) return solve(lo);
  const w = m - lo;
  return Math.exp((1 - w) * Math.log(solve(lo)) + w * Math.log(solve(hi)));
}

// Stretched equal-temperament targets for a piano with inharmonicity b.
// A4's first partial sits at a4Hz; the A3–A4 octave is divided evenly; every
// other key is tuned by octaves outward from it.
export function computeCurve(
  b: Float64Array,
  a4Hz = DEFAULT_A4_HZ,
  types: OctaveTypes = STRETCH_PRESETS.standard,
): TuningCurve {
  const f0 = new Float64Array(KEY_COUNT);
  const first = (k: number) => partialFrequency(f0[k], 1, b[k]);
  f0[A4_KEY] = a4Hz / Math.sqrt(1 + b[A4_KEY]);

  const a3 = A4_KEY - 12;
  f0[a3] = matchLower(f0[A4_KEY], b[A4_KEY], b[a3], octaveType(a3 + 1, types));
  const lowFirst = first(a3);
  const highFirst = first(A4_KEY);
  for (let k = a3 + 1; k < A4_KEY; k++) {
    const p1 = lowFirst * (highFirst / lowFirst) ** ((k - a3) / 12);
    f0[k] = p1 / Math.sqrt(1 + b[k]);
  }
  for (let k = A4_KEY + 1; k < KEY_COUNT; k++) {
    f0[k] = matchUpper(f0[k - 12], b[k - 12], b[k], octaveType(k, types));
  }
  for (let k = a3 - 1; k >= 0; k--) {
    f0[k] = matchLower(f0[k + 12], b[k + 12], b[k], octaveType(k, types));
  }
  return { f0, b: Float64Array.from(b), a4Hz };
}

// The curve shifted by a constant number of cents (e.g. to the piano's current pitch).
export function shiftCurve(curve: TuningCurve, offsetCents: number): TuningCurve {
  return { ...curve, f0: curve.f0.map((f) => shiftCents(f, offsetCents)) };
}

// Each key's first-partial target relative to plain equal temperament at a4Hz.
export function curveCentsFromET(curve: TuningCurve): number[] {
  return Array.from(curve.f0, (f, k) => cents(partialFrequency(f, 1, curve.b[k]), etFrequency(k, curve.a4Hz)));
}

// Octave types with handle i moved so the curve passes as close as possible
// to targetCents (from equal temperament) at that handle's key.
export function solveHandle(
  b: Float64Array,
  a4Hz: number,
  types: OctaveTypes,
  i: number,
  targetCents: number,
): OctaveTypes {
  const key = HANDLE_KEYS[i];
  const at = (m: number) => {
    const t = types.slice() as OctaveTypes;
    t[i] = m;
    return { t, c: curveCentsFromET(computeCurve(b, a4Hz, t))[key] };
  };
  let lo = MIN_OCTAVE_TYPE;
  let hi = MAX_OCTAVE_TYPE;
  const rising = at(hi).c > at(lo).c;
  for (let n = 0; n < 30; n++) {
    const mid = (lo + hi) / 2;
    if (at(mid).c < targetCents === rising) lo = mid;
    else hi = mid;
  }
  return at(Math.round(((lo + hi) / 2) * 100) / 100).t;
}
