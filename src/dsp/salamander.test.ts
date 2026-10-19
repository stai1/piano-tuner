import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Analyzer, deviationCents } from './analyzer';
import { defaultInharmonicityCurve } from './inharmonicity';
import { KEY_COUNT, etFrequency } from './notes';
import { readWav } from './testing/wav';

// Real piano recordings from the Salamander Grand Piano (Yamaha C5). Run
// `npm run samples` first; the tests are skipped when the files are missing.
const DIR = join(__dirname, '../../test-samples');
// The C8 sample sits about 90 cents above equal temperament, outside the
// detection window, so it is left out.
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.wav') && f !== 'C8.wav') : [];

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function keyFromFile(file: string): number {
  const [, letter, sharp, octave] = /^([A-G])(s?)(\d)\.wav$/.exec(file)!;
  return 12 * Number(octave) + PITCH_CLASS[letter] + (sharp ? 1 : 0) - 9;
}

// Treble notes decay within a few hundred milliseconds, so read them sooner.
function readTimes(key: number): number[] {
  if (key >= 72) return [0.25, 0.3, 0.35];
  if (key >= 60) return [0.4, 0.5, 0.6];
  return [0.9, 1.2, 1.5];
}

const B = defaultInharmonicityCurve();
const REF_F0 = Float64Array.from({ length: KEY_COUNT }, (_, k) => etFrequency(k) / Math.sqrt(1 + B[k]));

describe.skipIf(files.length === 0)('Salamander samples', () => {
  for (const file of files) {
    const key = keyFromFile(file);
    it(`${file} → key ${key}`, () => {
      const { sampleRate, samples } = readWav(join(DIR, file));
      const analyzer = new Analyzer(sampleRate);
      const readings: number[] = [];
      for (const t of readTimes(key)) {
        const upTo = samples.subarray(0, Math.round(t * sampleRate));
        const result = analyzer.analyze(upTo, { refF0: REF_F0, b: B });
        expect(result.detectedKey).toBe(key);
        const m = result.measurement!;
        const b = m.b ?? B[key];
        expect(b).toBeGreaterThan(1e-5);
        expect(b).toBeLessThan(0.05);
        readings.push(deviationCents(m, REF_F0[key], B[key]));
      }
      // Within a plausible stretch of equal temperament, and stable over time.
      // Treble trichords beat audibly in these recordings, so their readings
      // wander more.
      for (const c of readings) expect(Math.abs(c)).toBeLessThan(45);
      const spread = key >= 72 ? 6 : key < 12 || key >= 60 ? 3 : 1.5;
      expect(Math.max(...readings) - Math.min(...readings)).toBeLessThan(spread);
    });
  }
});
