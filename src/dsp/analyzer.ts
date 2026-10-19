import { nextPow2, powerSpectrum, type Spectrum } from './fft';
import { KEY_COUNT, cents, partialFrequency } from './notes';

export interface PartialReading {
  n: number;
  freq: number;
  db: number;
  // dB above the acceptance threshold; used as the partial's weight.
  strength: number;
}

export interface Measurement {
  key: number;
  partials: PartialReading[];
  // Fitted fundamental parameter (partial n sits at n * f0 * sqrt(1 + B n^2)).
  f0: number;
  // Fitted inharmonicity, or null when too few partials were found.
  b: number | null;
  // Strength of the strongest partial.
  strength: number;
}

export interface AnalyzeOptions {
  // Expected fundamental parameter per key, used to search for partials.
  refF0: ArrayLike<number>;
  // Inharmonicity estimate per key.
  b: ArrayLike<number>;
  // Skip detection and measure this key.
  lockedKey?: number | null;
}

export interface AnalysisResult {
  levelDb: number;
  detectedKey: number | null;
  measurement: Measurement | null;
}

const DETECT_PARTIALS = 8;
const DETECT_TOLERANCE_CENTS = 45;
const MIN_LEVEL_DB = -70;
const MIN_HZ = 25;
const MAX_PARTIAL_HZ = 8000;
// Peaks count as partials only within this range below the strongest peak,
// and this far above the noise floor.
const DYNAMIC_RANGE_DB = 50;
const FLOOR_MARGIN_DB = 10;
// A candidate's partial counts as present within this range of its strongest.
const PRESENCE_DB = 40;

export function measurementSeconds(key: number): number {
  if (key < 20) return 0.68;
  if (key < 44) return 0.34;
  return 0.17;
}

export function maxPartials(key: number): number {
  if (key < 12) return 12;
  if (key < 24) return 10;
  if (key < 36) return 8;
  if (key < 48) return 6;
  if (key < 60) return 4;
  if (key < 72) return 3;
  return 2;
}

interface Peak {
  freq: number;
  db: number;
}

// Level below which spectral peaks are ignored.
function peakThreshold(spec: Spectrum, maxHz: number): number {
  const lo = Math.max(1, Math.floor(MIN_HZ / spec.binHz));
  const hi = Math.min(spec.db.length - 1, Math.ceil(maxHz / spec.binHz));
  const band = spec.db.subarray(lo, hi);
  const sorted = Array.from(band).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length / 2)] ?? -120;
  const max = sorted[sorted.length - 1] ?? -120;
  return Math.max(floor + FLOOR_MARGIN_DB, max - DYNAMIC_RANGE_DB);
}

// Strongest local maximum within tolCents of freq, refined by parabolic
// interpolation of the dB values.
function peakNear(spec: Spectrum, freq: number, tolCents: number): Peak | null {
  const { db, binHz } = spec;
  const lo = Math.max(1, Math.floor(Math.max(MIN_HZ, freq * 2 ** (-tolCents / 1200)) / binHz));
  const hi = Math.min(db.length - 2, Math.ceil((freq * 2 ** (tolCents / 1200)) / binHz));
  let best = -1;
  for (let i = lo; i <= hi; i++) {
    if (db[i] >= db[i - 1] && db[i] >= db[i + 1] && (best < 0 || db[i] > db[best])) best = i;
  }
  if (best < 0) return null;
  const a = db[best - 1];
  const b = db[best];
  const c = db[best + 1];
  const denom = a - 2 * b + c;
  const p = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
  return { freq: (best + p) * binHz, db: b - 0.25 * (a - c) * p };
}

function windowLength(seconds: number, sampleRate: number): number {
  return 2 ** Math.round(Math.log2(seconds * sampleRate));
}

export class Analyzer {
  constructor(readonly sampleRate: number) {}

  analyze(samples: Float32Array, opts: AnalyzeOptions): AnalysisResult {
    const levelDb = rmsDb(samples, Math.min(samples.length, Math.round(this.sampleRate * 0.1)));
    if (levelDb < MIN_LEVEL_DB) return { levelDb, detectedKey: null, measurement: null };

    const detectedKey = this.detect(samples, opts);
    const key = opts.lockedKey ?? detectedKey;
    const measurement = key === null ? null : this.measure(samples, key, opts.refF0[key], opts.b[key]);
    return { levelDb, detectedKey, measurement };
  }

  detect(samples: Float32Array, opts: AnalyzeOptions): number | null {
    const len = windowLength(0.34, this.sampleRate);
    if (samples.length < len / 2) return null;
    const spec = powerSpectrum(samples, len, len * 2, this.sampleRate);
    const maxHz = Math.min(this.sampleRate * 0.45, MAX_PARTIAL_HZ);
    const threshold = peakThreshold(spec, maxHz);

    // Linear power above threshold of each expected partial of key k (0 when
    // absent); NaN when the partial is below the analyzed band.
    const cache = new Map<number, number[]>();
    const energies = (k: number): number[] => {
      const cached = cache.get(k);
      if (cached) return cached;
      const out: number[] = [];
      let lastFreq = 0;
      // Treble notes have few strong partials, so expect fewer of them.
      const f1 = partialFrequency(opts.refF0[k], 1, opts.b[k]);
      const count = Math.max(1, Math.min(DETECT_PARTIALS, Math.floor(2500 / f1)));
      for (let n = 1; n <= count; n++) {
        const f = partialFrequency(opts.refF0[k], n, opts.b[k]);
        if (f > maxHz) break;
        if (f < MIN_HZ) {
          out.push(NaN);
          continue;
        }
        const peak = peakNear(spec, f, DETECT_TOLERANCE_CENTS);
        const ok = peak && peak.db >= threshold && peak.freq !== lastFreq;
        if (ok) lastFreq = peak.freq;
        out.push(ok ? 10 ** ((peak.db - threshold) / 10) : 0);
      }
      cache.set(k, out);
      return out;
    };
    const sum = (e: number[], pick: (n: number) => boolean) =>
      e.reduce((acc, x, i) => (pick(i + 1) && !Number.isNaN(x) ? acc + x : acc), 0);
    const presentFraction = (e: number[], pick: (n: number) => boolean) => {
      const valid = e.filter((x, i) => pick(i + 1) && !Number.isNaN(x));
      const max = Math.max(0, ...e.filter((x) => !Number.isNaN(x)));
      if (valid.length === 0 || max === 0) return 0;
      return valid.filter((x) => x >= max * 10 ** (-PRESENCE_DB / 10)).length / valid.length;
    };

    // Score = spectral energy the candidate's partials explain, times the
    // squared fraction of its expected partials that are present.
    const all = () => true;
    let best = -1;
    let bestScore = 0;
    for (let k = 0; k < KEY_COUNT; k++) {
      const e = energies(k);
      const score = sum(e, all) * presentFraction(e, all) ** 2;
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    }
    if (best < 0) return null;

    // A note shares every partial of the note an octave (or twelfth) above.
    // Move up when nearly all of the energy sits on every 2nd (3rd) partial;
    // move down when the lower candidate's in-between partials carry real energy.
    for (let i = 0; i < 4; i++) {
      let moved = false;
      for (const [step, up] of [
        [2, 12],
        [3, 19],
      ]) {
        const shared = (n: number) => n % step === 0;
        const other = (n: number) => n % step !== 0;
        const e = energies(best);
        if (best + up < KEY_COUNT && sum(e, other) < 0.05 * sum(e, shared)) {
          best += up;
          moved = true;
          break;
        }
        const lower = best - up;
        if (lower >= 0) {
          const el = energies(lower);
          const sharedEnergy = sum(el, shared);
          if (sharedEnergy > 0 && sum(el, other) >= 0.1 * sharedEnergy && presentFraction(el, other) >= 0.5) {
            best = lower;
            moved = true;
            break;
          }
        }
      }
      if (!moved) break;
    }
    return best;
  }

  measure(samples: Float32Array, key: number, refF0: number, priorB: number): Measurement | null {
    const len = Math.min(windowLength(measurementSeconds(key), this.sampleRate), nextPow2(samples.length));
    const spec = powerSpectrum(samples, len, len * 4, this.sampleRate);
    const maxHz = Math.min(this.sampleRate * 0.45, MAX_PARTIAL_HZ);
    const threshold = peakThreshold(spec, maxHz);

    const search = (f0: number, b: number, tol: number): PartialReading[] => {
      const found: PartialReading[] = [];
      for (let n = 1; n <= maxPartials(key); n++) {
        const predicted = partialFrequency(f0, n, b);
        if (predicted > maxHz) break;
        const peak = peakNear(spec, predicted, tol);
        if (peak && peak.db >= threshold) {
          found.push({ n, freq: peak.freq, db: peak.db, strength: peak.db - threshold });
        }
      }
      return found;
    };

    // Coarse search around the expected pitch, then a narrow search around
    // the fitted partial series to pick up partials the first pass missed.
    let partials = robustSubset(search(refF0, priorB, 40), priorB);
    if (partials.length === 0) return null;
    const coarse = fitPartials(partials, priorB);
    partials = robustSubset(search(coarse.f0, coarse.b ?? priorB, 12), priorB);
    if (partials.length === 0) return null;
    const fit = fitPartials(partials, priorB);
    return {
      key,
      partials,
      f0: fit.f0,
      b: fit.b,
      strength: Math.max(...partials.map((p) => p.strength)),
    };
  }
}

// Drops the partial that fits worst until every partial sits within a few
// cents of the fitted series.
function robustSubset(partials: PartialReading[], priorB: number): PartialReading[] {
  let set = partials;
  while (set.length > 2) {
    const fit = fitPartials(set, priorB);
    const b = fit.b ?? priorB;
    let worst = 0;
    let worstErr = 0;
    set.forEach((p, i) => {
      const err = Math.abs(cents(p.freq, partialFrequency(fit.f0, p.n, b)));
      if (err > worstErr) {
        worstErr = err;
        worst = i;
      }
    });
    if (worstErr < 6) break;
    set = set.filter((_, i) => i !== worst);
  }
  return set;
}

// Weighted least squares on (f_n / n)^2 = f0^2 + f0^2 B n^2.
export function fitPartials(partials: PartialReading[], priorB: number): { f0: number; b: number | null } {
  const fallback = () => {
    let sw = 0;
    let s = 0;
    for (const p of partials) {
      const w = p.strength + 1;
      s += w * Math.log(p.freq / (p.n * Math.sqrt(1 + priorB * p.n * p.n)));
      sw += w;
    }
    return { f0: Math.exp(s / sw), b: null };
  };
  const distinct = new Set(partials.map((p) => p.n));
  if (distinct.size < 2) return fallback();

  let sw = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of partials) {
    const w = p.strength + 1;
    const x = p.n * p.n;
    const y = (p.freq / p.n) ** 2;
    sw += w;
    sx += w * x;
    sy += w * y;
    sxx += w * x * x;
    sxy += w * x * y;
  }
  const det = sw * sxx - sx * sx;
  if (det <= 0) return fallback();
  const slope = (sw * sxy - sx * sy) / det;
  const intercept = (sy - slope * sx) / sw;
  if (intercept <= 0) return fallback();
  const b = slope / intercept;
  if (!(b >= 0 && b < 0.05)) return fallback();
  return { f0: Math.sqrt(intercept), b };
}

// Weighted mean deviation, in cents, of the measured partials from where they
// should sit for a string with fundamental parameter targetF0 and inharmonicity b.
export function deviationCents(m: Measurement, targetF0: number, b: number): number {
  let sw = 0;
  let s = 0;
  for (const p of m.partials) {
    const w = p.strength + 1;
    s += w * cents(p.freq, partialFrequency(targetF0, p.n, b));
    sw += w;
  }
  return s / sw;
}

export function rmsDb(samples: Float32Array, length: number): number {
  let sum = 0;
  const start = samples.length - length;
  for (let i = start; i < samples.length; i++) sum += samples[i] * samples[i];
  return 10 * Math.log10(sum / Math.max(1, length) + 1e-20);
}

// Deviation read from a single partial, or null when it wasn't found.
export function partialDeviationCents(m: Measurement, targetF0: number, b: number, n: number): number | null {
  const p = m.partials.find((x) => x.n === n);
  return p ? cents(p.freq, partialFrequency(targetF0, n, b)) : null;
}
