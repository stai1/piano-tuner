import { describe, expect, it } from 'vitest';
import { BeatTracker } from './beats';
import { partialFrequency } from './notes';
import { synthString } from './testing/synth';

const SR = 48000;

function track(signal: Float32Array, partialHz: number, f0: number) {
  const tracker = new BeatTracker(SR);
  tracker.setFrequency(partialHz, f0);
  for (let i = 0; i < signal.length; i += 2048) tracker.push(signal.subarray(i, i + 2048));
  return tracker.estimate();
}

describe('BeatTracker', () => {
  const f0 = 440;
  const b = 4e-4;
  const p1 = partialFrequency(f0, 1, b);

  it('finds the beat of a mistuned unison', () => {
    // 4 cents apart at A4 is about 1 beat per second on partial 1.
    const signal = synthString({ sampleRate: SR, seconds: 3, f0, b, unisonDetuneCents: 4, t60: 12, noiseDb: -70 });
    const expected = p1 * (2 ** (4 / 1200) - 1);
    const est = track(signal, p1, f0);
    expect(est?.beatHz).not.toBeNull();
    expect(est!.beatHz! / expected).toBeGreaterThan(0.85);
    expect(est!.beatHz! / expected).toBeLessThan(1.15);
    expect(est!.depthDb).toBeGreaterThan(3);
  });

  it('finds faster beats', () => {
    const signal = synthString({ sampleRate: SR, seconds: 3, f0, b, unisonDetuneCents: 15, t60: 12, noiseDb: -70 });
    const expected = p1 * (2 ** (15 / 1200) - 1);
    const est = track(signal, p1, f0);
    expect(est!.beatHz! / expected).toBeGreaterThan(0.85);
    expect(est!.beatHz! / expected).toBeLessThan(1.15);
  });

  it('reports a single string as steady', () => {
    const signal = synthString({ sampleRate: SR, seconds: 3, f0, b, t60: 6, noiseDb: -70 });
    const est = track(signal, p1, f0);
    expect(est!.beatHz).toBeNull();
    expect(est!.depthDb).toBeLessThan(0.5);
  });

  it('needs more than a second of sound', () => {
    const signal = synthString({ sampleRate: SR, seconds: 0.8, f0, b });
    expect(track(signal, p1, f0)).toBeNull();
  });
});
