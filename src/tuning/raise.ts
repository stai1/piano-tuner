import { THRESHOLDS } from './thresholds';

export type RaiseWarning = 'none' | 'large' | 'very-large';

export function raiseWarning(raiseCents: number): RaiseWarning {
  const size = Math.abs(raiseCents);
  if (size > THRESHOLDS.veryLargeRaiseCents) return 'very-large';
  if (size > THRESHOLDS.largeRaiseCents) return 'large';
  return 'none';
}

// Default number of passes for a change of pitch of this size.
export function recommendedPasses(raiseCents: number): number {
  const size = Math.abs(raiseCents);
  if (size > THRESHOLDS.veryLargeRaiseCents) return 3;
  if (size > THRESHOLDS.twoPassRaiseCents) return 2;
  return 1;
}

// Share of a note's starting error to overshoot by: the strings tuned later
// pull the frame and lower the pitch of those tuned earlier. Bass strings
// lose less than treble strings.
export function overpullFactor(key: number): number {
  if (key < 20) return 0.2;
  if (key < 60) return 0.2 + (0.05 * (key - 20)) / 40;
  return 0.25 + (0.1 * (key - 60)) / 27;
}

// Cap on the overshoot itself, to keep string tension within reason even
// when the raise is very large. The raise itself is not limited.
export const MAX_OVERPULL_CENTS = 25;

// Extra cents to aim past the final target on a rough pass, given the note's
// starting offset from that target (negative when flat).
export function overpullCents(key: number, startOffsetCents: number): number {
  const over = -startOffsetCents * overpullFactor(key);
  return Math.max(-MAX_OVERPULL_CENTS, Math.min(MAX_OVERPULL_CENTS, over));
}

// Every pass but the last is a rough pass with overpull.
export function passUsesOverpull(pass: number, passes: number): boolean {
  return pass < passes;
}
