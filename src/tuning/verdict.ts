import type { Check } from '../storage/schema';
import type { Verdict } from './check';

export const VERDICT_LABEL: Record<Verdict, string> = {
  'in-tune': 'In tune',
  'touch-up': 'Touch-up',
  'pitch-raise': 'Pitch raise recommended',
  'large-pitch-raise': 'Large pitch raise',
};

export const VERDICT_TONE: Record<Verdict, 'ok' | 'warn' | 'danger'> = {
  'in-tune': 'ok',
  'touch-up': 'ok',
  'pitch-raise': 'warn',
  'large-pitch-raise': 'danger',
};

// A pitch as the A4 it corresponds to, e.g. "A437.5" or "A440".
export function formatA4(hz: number): string {
  return `A${Math.round(hz * 10) / 10}`;
}

// e.g. "10 cents flat on average (A437.5)".
function averagePhrase(check: Check): string {
  const c = check.averageCents;
  const size = Math.abs(c);
  const amount =
    size < 0.05 ? 'on pitch' : `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${size === 1 ? 'cent' : 'cents'} ${c < 0 ? 'flat' : 'sharp'}`;
  return `${amount} on average (${formatA4(check.measuredA4Hz)})`;
}

export function verdictText(check: Check, a4Hz: number): string {
  const avg = averagePhrase(check);
  switch (check.verdict) {
    case 'in-tune':
      return `Your piano is ${avg}. No tuning needed.`;
    case 'touch-up':
      return `Your piano is ${avg}, close to ${formatA4(a4Hz)}. Touch up any notes or unisons that sound off, at the piano's current pitch.`;
    case 'pitch-raise':
      return `Your piano is ${avg}. A pitch raise brings it back to ${formatA4(a4Hz)}.`;
    case 'large-pitch-raise':
      return `Your piano is ${avg}. A change this large has a higher risk of broken strings.`;
  }
}
