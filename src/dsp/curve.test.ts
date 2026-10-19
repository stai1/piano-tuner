import { describe, expect, it } from 'vitest';
import { STRETCH_PRESETS, computeCurve, curveCentsFromET, shiftCurve, solveHandle } from './curve';
import { defaultInharmonicityCurve, interpolateInharmonicity } from './inharmonicity';
import { A4_KEY, KEY_COUNT, cents, partialFrequency } from './notes';

const B = defaultInharmonicityCurve();

describe('computeCurve', () => {
  const curve = computeCurve(B);
  const offsets = curveCentsFromET(curve);

  it('puts A4 exactly on the reference', () => {
    expect(partialFrequency(curve.f0[A4_KEY], 1, B[A4_KEY])).toBeCloseTo(440, 6);
    expect(offsets[A4_KEY]).toBeCloseTo(0, 6);
  });

  it('stretches the treble sharp and the bass flat', () => {
    expect(offsets[87]).toBeGreaterThan(15);
    expect(offsets[87]).toBeLessThan(60);
    expect(offsets[0]).toBeLessThan(-10);
    expect(offsets[0]).toBeGreaterThan(-50);
  });

  it('rises monotonically across the keyboard', () => {
    for (let k = 1; k < KEY_COUNT; k++) expect(offsets[k]).toBeGreaterThanOrEqual(offsets[k - 1] - 0.05);
  });

  it('makes treble octaves beatless at 4:2 just above A4', () => {
    const k = A4_KEY + 1;
    const lower = partialFrequency(curve.f0[k - 12], 4, B[k - 12]);
    const upper = partialFrequency(curve.f0[k], 2, B[k]);
    expect(Math.abs(cents(upper, lower))).toBeLessThan(0.1);
  });

  it('orders the presets by amount of stretch', () => {
    const narrow = curveCentsFromET(computeCurve(B, 440, STRETCH_PRESETS.narrow));
    const wide = curveCentsFromET(computeCurve(B, 440, STRETCH_PRESETS.wide));
    expect(narrow[87]).toBeLessThan(offsets[87]);
    expect(wide[87]).toBeGreaterThan(offsets[87]);
    expect(narrow[0]).toBeGreaterThan(offsets[0]);
    expect(wide[0]).toBeLessThan(offsets[0]);
  });

  it('follows a custom A4', () => {
    const c = computeCurve(B, 442);
    expect(partialFrequency(c.f0[A4_KEY], 1, B[A4_KEY])).toBeCloseTo(442, 6);
  });

  it('moves a handle to put the curve where it is dragged', () => {
    const types = solveHandle(B, 440, STRETCH_PRESETS.standard, 4, 40);
    expect(types.slice(0, 4)).toEqual(STRETCH_PRESETS.standard.slice(0, 4));
    expect(curveCentsFromET(computeCurve(B, 440, types))[87]).toBeCloseTo(40, 0);
    const bass = solveHandle(B, 440, STRETCH_PRESETS.standard, 0, -30);
    expect(bass[0]).toBeGreaterThan(STRETCH_PRESETS.standard[0]);
    expect(curveCentsFromET(computeCurve(B, 440, bass))[0]).toBeCloseTo(-30, 0);
  });

  it('stops at the handle range', () => {
    const types = solveHandle(B, 440, STRETCH_PRESETS.standard, 3, 500);
    expect(types[3]).toBe(6);
  });

  it('shifts by a constant offset', () => {
    const shifted = shiftCurve(curve, -20);
    expect(cents(shifted.f0[10], curve.f0[10])).toBeCloseTo(-20, 6);
  });
});

describe('interpolateInharmonicity', () => {
  it('returns the default curve with no measurements', () => {
    expect(Array.from(interpolateInharmonicity(new Map()))).toEqual(Array.from(B));
  });

  it('passes through measured keys and interpolates in log space', () => {
    const curve = interpolateInharmonicity(
      new Map([
        [24, 2e-4],
        [36, 8e-4],
      ]),
    );
    expect(curve[24]).toBeCloseTo(2e-4, 10);
    expect(curve[36]).toBeCloseTo(8e-4, 10);
    expect(curve[30]).toBeCloseTo(4e-4, 10);
  });

  it('extrapolates with the default shape', () => {
    const curve = interpolateInharmonicity(new Map([[48, 2 * B[48]]]));
    expect(curve[87] / B[87]).toBeCloseTo(2, 6);
    expect(curve[0] / B[0]).toBeCloseTo(2, 6);
  });
});
