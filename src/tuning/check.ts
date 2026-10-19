import { THRESHOLDS } from './thresholds';

export type Verdict = 'in-tune' | 'touch-up' | 'pitch-raise' | 'large-pitch-raise';

export interface CheckNote {
  key: number;
  // Offset from the A440 curve, in cents; null when the note gave no reading.
  cents: number | null;
  beatHz?: number | null;
  depthDb?: number;
}

export interface CheckSummary {
  verdict: Verdict;
  averageCents: number;
  outliers: number[];
  unisonSuspects: number[];
  missing: number[];
}

export function summarizeCheck(notes: CheckNote[]): CheckSummary | null {
  const measured = notes.filter((n): n is CheckNote & { cents: number } => n.cents !== null);
  if (measured.length === 0) return null;
  const averageCents = measured.reduce((a, n) => a + n.cents, 0) / measured.length;
  const outliers = measured
    .filter((n) => Math.abs(n.cents - averageCents) > THRESHOLDS.touchUp.outlierCents)
    .map((n) => n.key);
  const unisonSuspects = measured.filter((n) => isUnisonSuspect(n.beatHz ?? null, n.depthDb ?? 0)).map((n) => n.key);
  const missing = notes.filter((n) => n.cents === null).map((n) => n.key);

  let verdict: Verdict;
  const avg = Math.abs(averageCents);
  if (avg <= THRESHOLDS.inTune.averageCents && measured.every((n) => Math.abs(n.cents) <= THRESHOLDS.inTune.noteCents)) {
    verdict = 'in-tune';
  } else if (avg <= THRESHOLDS.touchUp.averageCents) {
    verdict = 'touch-up';
  } else if (avg <= THRESHOLDS.largeRaiseCents) {
    verdict = 'pitch-raise';
  } else {
    verdict = 'large-pitch-raise';
  }
  return { verdict, averageCents, outliers, unisonSuspects, missing };
}

// Beating clear enough to suggest the strings of a note disagree by more
// than the unison threshold.
export function isUnisonSuspect(beatHz: number | null, depthDb: number): boolean {
  return beatHz !== null && beatHz >= 0.3 && depthDb >= 1.5;
}
