import { describe, expect, it } from 'vitest';
import { summarizeCheck } from './check';
import { overpullCents, passUsesOverpull, raiseWarning, recommendedPasses } from './raise';

describe('summarizeCheck', () => {
  const notes = (...cents: (number | null)[]) => cents.map((c, i) => ({ key: i * 12, cents: c }));

  it('calls a piano in tune', () => {
    expect(summarizeCheck(notes(1, -2, 0.5, 2))?.verdict).toBe('in-tune');
  });

  it('wants a touch-up when one note is out', () => {
    expect(summarizeCheck(notes(1, -2, 7, 2))?.verdict).toBe('touch-up');
  });

  it('recommends a pitch raise past 8 cents', () => {
    const s = summarizeCheck(notes(-10, -12, -9, -11))!;
    expect(s.verdict).toBe('pitch-raise');
    expect(s.averageCents).toBeCloseTo(-10.5);
  });

  it('flags a large pitch raise past 30 cents', () => {
    expect(summarizeCheck(notes(-40, -35, -38))?.verdict).toBe('large-pitch-raise');
  });

  it('lists outliers and missing notes', () => {
    const s = summarizeCheck(notes(0, 1, 25, null, -1))!;
    expect(s.outliers).toEqual([24]);
    expect(s.missing).toEqual([36]);
  });

  it('flags notes whose strings beat', () => {
    const s = summarizeCheck([
      { key: 0, cents: 0, beatHz: 1.2, depthDb: 4 },
      { key: 12, cents: 0, beatHz: null, depthDb: 0.2 },
    ])!;
    expect(s.unisonSuspects).toEqual([0]);
  });

  it('needs at least one reading', () => {
    expect(summarizeCheck(notes(null, null))).toBeNull();
  });
});

describe('pitch raise', () => {
  it('plans passes by size', () => {
    expect(recommendedPasses(-10)).toBe(1);
    expect(recommendedPasses(-25)).toBe(2);
    expect(recommendedPasses(-80)).toBe(3);
  });

  it('warns without limiting', () => {
    expect(raiseWarning(-20)).toBe('none');
    expect(raiseWarning(-35)).toBe('large');
    expect(raiseWarning(-120)).toBe('very-large');
  });

  it('overpulls in the direction of the change', () => {
    expect(overpullCents(40, -40)).toBeGreaterThan(0);
    expect(overpullCents(40, 30)).toBeLessThan(0);
    expect(overpullCents(80, -40)).toBeGreaterThan(overpullCents(10, -40));
    expect(overpullCents(40, -400)).toBe(25);
  });

  it('uses overpull on rough passes only', () => {
    expect(passUsesOverpull(1, 2)).toBe(true);
    expect(passUsesOverpull(2, 2)).toBe(false);
    expect(passUsesOverpull(1, 1)).toBe(false);
  });
});
