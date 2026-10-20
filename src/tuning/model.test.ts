import { describe, expect, it } from 'vitest';
import { newPiano, type Check } from '../storage/schema';
import { checkAgainst, currentOffsetCents, latestCheck } from './model';
import { verdictText } from './verdict';

function check(averageCents: number, referenceA4Hz = 440): Check {
  return {
    id: 'c',
    date: '2026-10-19T12:00:00.000Z',
    referenceA4Hz,
    measuredA4Hz: referenceA4Hz * 2 ** (averageCents / 1200),
    averageCents,
    verdict: 'pitch-raise',
    notes: [
      { key: 36, cents: averageCents - 1 },
      { key: 48, cents: averageCents + 1 },
    ],
  };
}

describe('checkAgainst', () => {
  it('re-expresses offsets and the verdict against a new reference', () => {
    const c = check(-10);
    // The piano measured A437.5; against a 437.5 reference it is in tune.
    const moved = checkAgainst(c, c.measuredA4Hz);
    expect(moved.averageCents).toBeCloseTo(0, 6);
    expect(moved.notes.map((n) => n.cents)).toEqual([expect.closeTo(-1, 6), expect.closeTo(1, 6)]);
    expect(moved.verdict).toBe('in-tune');
    expect(moved.measuredA4Hz).toBe(c.measuredA4Hz);
  });

  it('keeps the current offset right after the reference pitch changes', () => {
    const piano = { ...newPiano('Test'), checks: [check(-10)], a4Hz: 442 };
    // A437.5 is about 17.9 cents below A442.
    expect(currentOffsetCents(piano)).toBeCloseTo(1200 * Math.log2(440 * 2 ** (-10 / 1200) / 442), 6);
    expect(latestCheck(piano)?.referenceA4Hz).toBe(442);
  });
});

describe('verdictText', () => {
  it('states the average and the pitch it corresponds to', () => {
    expect(verdictText(check(-10), 440)).toBe('Your piano is 10 cents flat on average (A437.5). A pitch raise brings it back to A440.');
    expect(verdictText({ ...check(2.34), verdict: 'in-tune' }, 440)).toBe(
      'Your piano is 2.3 cents sharp on average (A440.6). No tuning needed.',
    );
  });
});
