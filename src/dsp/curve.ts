import { A4_KEY, DEFAULT_A4_HZ, KEY_COUNT, cents, etFrequency, partialFrequency, shiftCents } from './notes';

export type StretchStyle = 'narrow' | 'standard' | 'wide';

export const STRETCH_STYLES: StretchStyle[] = ['narrow', 'standard', 'wide'];

export interface TuningCurve {
  // Target fundamental parameter per key (partial n at n * f0 * sqrt(1 + B n^2)).
  f0: Float64Array;
  b: Float64Array;
  a4Hz: number;
}

// Octave type used when tuning key k from the key an octave away, as m where
// the lower note's partial 2m is matched to the upper note's partial m
// (1 = 2:1 octaves, 2 = 4:2, 3 = 6:3). Fractional values blend two types.
function octaveType(key: number, style: StretchStyle): number {
  const shift = style === 'narrow' ? -1 : style === 'wide' ? (key > A4_KEY ? 0.5 : 1) : 0;
  let m: number;
  if (key > A4_KEY) {
    // Treble: 4:2 just above the temperament octave, easing to 2:1 by C7.
    m = 2 - Math.min(1, (key - (A4_KEY + 1)) / 26);
  } else if (key < A4_KEY - 12) {
    // Bass: 4:2 at the tenor, widening to 6:3 by D#2 and 8:4 at A0.
    const d = A4_KEY - 12 - key;
    m = 2 + Math.min(1, d / 15) + Math.max(0, (d - 15) / 21);
  } else {
    m = 2;
  }
  return Math.max(1, m + shift);
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
export function computeCurve(b: Float64Array, a4Hz = DEFAULT_A4_HZ, style: StretchStyle = 'standard'): TuningCurve {
  const f0 = new Float64Array(KEY_COUNT);
  const first = (k: number) => partialFrequency(f0[k], 1, b[k]);
  f0[A4_KEY] = a4Hz / Math.sqrt(1 + b[A4_KEY]);

  const a3 = A4_KEY - 12;
  f0[a3] = matchLower(f0[A4_KEY], b[A4_KEY], b[a3], octaveType(a3 + 1, style));
  const lowFirst = first(a3);
  const highFirst = first(A4_KEY);
  for (let k = a3 + 1; k < A4_KEY; k++) {
    const p1 = lowFirst * (highFirst / lowFirst) ** ((k - a3) / 12);
    f0[k] = p1 / Math.sqrt(1 + b[k]);
  }
  for (let k = A4_KEY + 1; k < KEY_COUNT; k++) {
    f0[k] = matchUpper(f0[k - 12], b[k - 12], b[k], octaveType(k, style));
  }
  for (let k = a3 - 1; k >= 0; k--) {
    f0[k] = matchLower(f0[k + 12], b[k + 12], b[k], octaveType(k, style));
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
