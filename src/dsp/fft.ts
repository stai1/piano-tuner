// In-place iterative radix-2 FFT with cached tables per size.
class FFTPlan {
  readonly size: number;
  private readonly rev: Uint32Array;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error(`FFT size must be a power of two, got ${size}`);
    }
    this.size = size;
    const bits = Math.log2(size);
    this.rev = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(size / 2);
    this.sin = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / size);
    }
  }

  transform(re: Float64Array, im: Float64Array): void {
    const n = this.size;
    const rev = this.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let start = 0; start < n; start += len) {
        for (let k = 0; k < half; k++) {
          const wr = this.cos[k * step];
          const wi = this.sin[k * step];
          const a = start + k;
          const b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  }
}

const plans = new Map<number, FFTPlan>();

export function fftPlan(size: number): FFTPlan {
  let plan = plans.get(size);
  if (!plan) {
    plan = new FFTPlan(size);
    plans.set(size, plan);
  }
  return plan;
}

const windows = new Map<number, Float64Array>();

export function hannWindow(length: number): Float64Array {
  let w = windows.get(length);
  if (!w) {
    w = new Float64Array(length);
    for (let i = 0; i < length; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
    windows.set(length, w);
  }
  return w;
}

export interface Spectrum {
  // Power in dB per bin, bins 0..fftSize/2.
  db: Float64Array;
  binHz: number;
  fftSize: number;
}

// Hann-windowed, zero-padded power spectrum of the last `length` samples.
export function powerSpectrum(
  samples: Float32Array,
  length: number,
  fftSize: number,
  sampleRate: number,
): Spectrum {
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const n = Math.min(length, samples.length, fftSize);
  const offset = samples.length - n;
  const w = hannWindow(n);
  for (let i = 0; i < n; i++) re[i] = samples[offset + i] * w[i];
  fftPlan(fftSize).transform(re, im);
  const bins = fftSize / 2 + 1;
  const db = new Float64Array(bins);
  // Normalize so a full-scale sine reads about 0 dB regardless of window length.
  const norm = 4 / (n * n);
  for (let i = 0; i < bins; i++) {
    db[i] = 10 * Math.log10((re[i] * re[i] + im[i] * im[i]) * norm + 1e-20);
  }
  return { db, binHz: sampleRate / fftSize, fftSize };
}

export function nextPow2(n: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(2, n)));
}

// Peak level per log-spaced band, for display.
export function logBands(spec: Spectrum, minHz: number, maxHz: number, bands: number): Float32Array {
  const out = new Float32Array(bands).fill(-140);
  const ratio = maxHz / minHz;
  for (let i = 0; i < bands; i++) {
    const lo = Math.max(1, Math.floor((minHz * ratio ** (i / bands)) / spec.binHz));
    const hi = Math.min(spec.db.length - 1, Math.max(lo, Math.ceil((minHz * ratio ** ((i + 1) / bands)) / spec.binHz)));
    for (let k = lo; k <= hi; k++) if (spec.db[k] > out[i]) out[i] = spec.db[k];
  }
  return out;
}
