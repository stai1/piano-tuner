// Conservative starting values; all offsets are cents against the piano's
// stretched curve. Kept in one place so they are easy to adjust.
export const THRESHOLDS = {
  inTune: { averageCents: 3, noteCents: 5 },
  touchUp: { averageCents: 8, outlierCents: 15 },
  twoPassRaiseCents: 20,
  largeRaiseCents: 30,
  veryLargeRaiseCents: 50,
  unisonMismatchCents: 2,
} as const;

// A note counts as tuned when it holds within this of its target.
export const TUNED_TOLERANCE_CENTS = 1;
