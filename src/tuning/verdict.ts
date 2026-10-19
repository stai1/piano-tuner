import { formatCents } from '../components/CheckChart';
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

export function verdictText(check: Check, a4Hz: number): string {
  const off = formatCents(check.averageCents);
  const dir = check.averageCents < 0 ? 'flat' : 'sharp';
  switch (check.verdict) {
    case 'in-tune':
      return `Your piano is ${off} from A${a4Hz} on average. No tuning needed.`;
    case 'touch-up':
      return `Your piano is close to pitch (${off} on average). Touch up any notes or unisons that sound off, at the piano's current pitch.`;
    case 'pitch-raise':
      return `Your piano is ${Math.abs(check.averageCents).toFixed(0)} cents ${dir} on average. A pitch raise brings it back to A${a4Hz}.`;
    case 'large-pitch-raise':
      return `Your piano is ${Math.abs(check.averageCents).toFixed(0)} cents ${dir} on average. A change this large has a higher risk of broken strings.`;
  }
}
