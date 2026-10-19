import { computeCurve, shiftCurve, type TuningCurve } from '../dsp/curve';
import { interpolateInharmonicity } from '../dsp/inharmonicity';
import { KEY_COUNT, cents, partialFrequency } from '../dsp/notes';
import type { Check, Piano } from '../storage/schema';

// Notes played in a check: every A, plus the top C.
export const CHECK_KEYS = [0, 12, 24, 36, 48, 60, 72, 84, 87];

export function inharmonicityCurve(piano: Piano): Float64Array {
  return interpolateInharmonicity(new Map(piano.inharmonicity.map((r) => [r.key, r.b])));
}

// The piano's target curve at its reference pitch (A4 = piano.a4Hz).
export function referenceCurve(piano: Piano): TuningCurve {
  return computeCurve(inharmonicityCurve(piano), piano.a4Hz, piano.octaveTypes);
}

export function latestCheck(piano: Piano): Check | null {
  return piano.checks.length > 0 ? piano.checks[piano.checks.length - 1] : null;
}

// Where the piano sits now relative to its reference curve (0 if never checked).
export function currentOffsetCents(piano: Piano): number {
  return latestCheck(piano)?.averageCents ?? 0;
}

export function analysisConfig(curve: TuningCurve, offsetCents: number, lockedKey: number | null) {
  const shifted = shiftCurve(curve, offsetCents);
  return { refF0: Array.from(shifted.f0), b: Array.from(curve.b), lockedKey };
}

// Fundamental parameter for which a reading of `deviation` cents against
// targetF0 would read zero.
export function readingToF0(targetF0: number, deviation: number): number {
  return targetF0 * 2 ** (deviation / 1200);
}

// First-partial offset of f0 from the curve at key, in cents.
export function centsFromCurve(curve: TuningCurve, key: number, f0: number): number {
  const b = curve.b[key];
  return cents(partialFrequency(f0, 1, b), partialFrequency(curve.f0[key], 1, b));
}

export function clampKeyIndex(key: number): number {
  return Math.max(0, Math.min(KEY_COUNT - 1, key));
}
