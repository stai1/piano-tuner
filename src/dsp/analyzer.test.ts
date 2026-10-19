import { describe, expect, it } from 'vitest';
import { Analyzer, deviationCents } from './analyzer';
import { defaultInharmonicityCurve } from './inharmonicity';
import { KEY_COUNT, etFrequency, keyName, shiftCents } from './notes';
import { synthString } from './testing/synth';

const SR = 48000;
const B = defaultInharmonicityCurve();
const REF_F0 = Float64Array.from({ length: KEY_COUNT }, (_, k) => etFrequency(k) / Math.sqrt(1 + B[k]));
const analyzer = new Analyzer(SR);

function note(key: number, detuneCents: number, extra: Partial<Parameters<typeof synthString>[0]> = {}) {
  return synthString({
    sampleRate: SR,
    seconds: 1,
    f0: shiftCents(REF_F0[key], detuneCents),
    b: B[key],
    noiseDb: -60,
    seed: key + 1,
    // Bass strings have a weak fundamental.
    amplitude: key < 20 ? (n) => (n === 1 ? 0.1 : 1 / Math.sqrt(n)) : (n) => 1 / n,
    ...extra,
  });
}

describe('Analyzer.detect', () => {
  for (let key = 0; key < KEY_COUNT; key += 3) {
    it(`detects ${keyName(key)}`, () => {
      const result = analyzer.analyze(note(key, 12), { refF0: REF_F0, b: B });
      expect(result.detectedKey).toBe(key);
    });
  }

  it('detects the top key', () => {
    expect(analyzer.analyze(note(87, -10), { refF0: REF_F0, b: B }).detectedKey).toBe(87);
  });

  it('returns nothing for silence', () => {
    const result = analyzer.analyze(new Float32Array(SR), { refF0: REF_F0, b: B });
    expect(result.detectedKey).toBeNull();
    expect(result.measurement).toBeNull();
  });
});

describe('Analyzer.measure', () => {
  const cases: [number, number, number][] = [
    // key, detune (cents), tolerance (cents)
    [3, -7.5, 0.5], // C1, weak fundamental
    [24, 4.2, 0.3], // A2
    [48, 3.2, 0.2], // A4
    [60, -2.6, 0.3], // A5
    [75, 5.5, 0.5], // C7
    [87, -4, 1], // C8
  ];
  for (const [key, detune, tol] of cases) {
    it(`measures ${keyName(key)} detuned ${detune} cents within ±${tol}`, () => {
      const m = analyzer.measure(note(key, detune), key, REF_F0[key], B[key]);
      expect(m).not.toBeNull();
      expect(deviationCents(m!, REF_F0[key], B[key])).toBeCloseTo(detune, 0);
      expect(Math.abs(deviationCents(m!, REF_F0[key], B[key]) - detune)).toBeLessThan(tol);
    });
  }

  it('fits inharmonicity in the tenor', () => {
    const b = 6e-4;
    const signal = synthString({ sampleRate: SR, f0: 196, b, noiseDb: -60 });
    const m = analyzer.measure(signal, 34, 196, B[34]);
    expect(m?.b).not.toBeNull();
    expect(m!.b! / b).toBeGreaterThan(0.9);
    expect(m!.b! / b).toBeLessThan(1.1);
  });

  it('copes with a 60-cent-flat piano when told the offset', () => {
    const offsetRef = REF_F0.map((f) => shiftCents(f, -60));
    const signal = note(40, -62);
    const result = analyzer.analyze(signal, { refF0: offsetRef, b: B });
    expect(result.detectedKey).toBe(40);
    expect(deviationCents(result.measurement!, REF_F0[40], B[40])).toBeCloseTo(-62, 0);
  });
});
