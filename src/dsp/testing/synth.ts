import { partialFrequency } from '../notes';

export interface StringSynthOptions {
  sampleRate?: number;
  seconds?: number;
  f0: number;
  b: number;
  partials?: number;
  // Amplitude of partial n (before decay).
  amplitude?: (n: number) => number;
  // Time for partial 1 to decay by 60 dB; higher partials decay faster.
  t60?: number;
  // Second string of a unison, detuned by this many cents. Omit for one string.
  unisonDetuneCents?: number;
  // Peak level of white noise added to the signal, in dBFS.
  noiseDb?: number;
  seed?: number;
}

function prng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// Sum of decaying stiff-string partials, normalized to a 0.5 peak.
export function synthString(opts: StringSynthOptions): Float32Array {
  const sr = opts.sampleRate ?? 48000;
  const len = Math.round(sr * (opts.seconds ?? 1));
  const out = new Float32Array(len);
  const amp = opts.amplitude ?? ((n: number) => 1 / n);
  const t60 = opts.t60 ?? 4;
  const strings = opts.unisonDetuneCents === undefined ? [0] : [0, opts.unisonDetuneCents];
  const rand = prng(opts.seed ?? 1);
  for (const detune of strings) {
    const f0 = opts.f0 * 2 ** (detune / 1200);
    for (let n = 1; n <= (opts.partials ?? 16); n++) {
      const f = partialFrequency(f0, n, opts.b);
      if (f > sr * 0.45) break;
      const a = amp(n);
      const decay = (6.91 / t60) * (1 + 0.3 * (n - 1));
      const w = (2 * Math.PI * f) / sr;
      const phase = rand() * 2 * Math.PI;
      for (let i = 0; i < len; i++) out[i] += a * Math.exp((-decay * i) / sr) * Math.sin(w * i + phase);
    }
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  const scale = peak > 0 ? 0.5 / peak : 1;
  const noise = opts.noiseDb === undefined ? 0 : 10 ** (opts.noiseDb / 20);
  for (let i = 0; i < len; i++) out[i] = out[i] * scale + noise * (rand() * 2 - 1);
  return out;
}
