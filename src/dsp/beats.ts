import { cents } from './notes';

export interface BeatEstimate {
  // Beat rate of the tracked partial, or null when no clear periodicity.
  beatHz: number | null;
  // Peak-to-peak amplitude wobble left after removing the decay, in dB.
  depthDb: number;
}

const HISTORY_SECONDS = 4;
const MIN_SECONDS = 1.2;
const ONSET_JUMP_DB = 6;

// Tracks the amplitude envelope of one partial to find beating between the
// strings of a unison.
export class BeatTracker {
  private freq = 0;
  private blockLength = 0;
  private pending = new Float32Array(0);
  private times: number[] = [];
  private levels: number[] = [];
  private clock = 0;

  constructor(readonly sampleRate: number) {}

  // Partial to follow, and the note's fundamental (sets how narrow the filter
  // must be to keep neighboring partials out).
  setFrequency(partialHz: number, fundamentalHz: number): void {
    if (this.freq === 0 || Math.abs(cents(partialHz, this.freq)) > 30) this.reset();
    this.freq = partialHz;
    this.blockLength = Math.round(this.sampleRate * Math.max(0.04, 2.5 / fundamentalHz));
  }

  reset(): void {
    this.times = [];
    this.levels = [];
    this.pending = new Float32Array(0);
  }

  push(chunk: Float32Array): void {
    this.clock += chunk.length;
    if (this.freq === 0 || this.blockLength === 0) return;
    const joined = new Float32Array(this.pending.length + chunk.length);
    joined.set(this.pending);
    joined.set(chunk, this.pending.length);
    const hop = this.blockLength >> 1;
    let start = 0;
    while (start + this.blockLength <= joined.length) {
      const db = this.blockLevel(joined, start);
      // A new strike rises well above anything recent; recovering from a beat
      // null does not.
      const t = (this.clock - joined.length + start + this.blockLength / 2) / this.sampleRate;
      if (this.levels.length > 0 && db > this.recentMax(t - 0.5) + ONSET_JUMP_DB) {
        this.times = [];
        this.levels = [];
      }
      this.times.push(t);
      this.levels.push(db);
      start += hop;
    }
    this.pending = joined.slice(start);
    const cutoff = this.clock / this.sampleRate - HISTORY_SECONDS;
    while (this.times.length > 0 && this.times[0] < cutoff) {
      this.times.shift();
      this.levels.shift();
    }
  }

  estimate(): BeatEstimate | null {
    const n = this.levels.length;
    if (n < 4 || this.times[n - 1] - this.times[0] < MIN_SECONDS) return null;

    // Remove the (roughly linear in dB) decay.
    const t = this.times;
    const y = this.levels;
    const mt = t.reduce((a, b) => a + b, 0) / n;
    const my = y.reduce((a, b) => a + b, 0) / n;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (t[i] - mt) * (y[i] - my);
      sxx += (t[i] - mt) ** 2;
    }
    const slope = sxx > 0 ? sxy / sxx : 0;
    const r = y.map((v, i) => v - (my + slope * (t[i] - mt)));
    const rms = Math.sqrt(r.reduce((a, b) => a + b * b, 0) / n);
    const depthDb = 2 * Math.SQRT2 * rms;

    // Strongest autocorrelation peak between 0.3 and 8 Hz.
    const dt = (t[n - 1] - t[0]) / (n - 1);
    const energy = r.reduce((a, b) => a + b * b, 0);
    const minLag = Math.max(1, Math.round(1 / 8 / dt));
    const maxLag = Math.min(Math.floor(n / 2), Math.round(1 / 0.3 / dt));
    const corr: number[] = [];
    for (let lag = 0; lag <= maxLag; lag++) {
      let c = 0;
      for (let i = 0; i + lag < n; i++) c += r[i] * r[i + lag];
      corr.push(c / (energy * ((n - lag) / n) || 1));
    }
    // Local maxima past the lobe around lag 0; take the shortest lag close to
    // the best one so multiples of the beat period don't win.
    const peaks: number[] = [];
    for (let lag = Math.max(minLag, 1); lag < maxLag; lag++) {
      if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1]) peaks.push(lag);
    }
    const top = Math.max(0, ...peaks.map((l) => corr[l]));
    const bestLag = peaks.find((l) => corr[l] >= 0.9 * top) ?? 0;
    const bestCorr = bestLag ? corr[bestLag] : 0;
    const beatHz = bestCorr > 0.4 && depthDb > 0.5 ? 1 / (bestLag * dt) : null;
    return { beatHz, depthDb };
  }

  private recentMax(since: number): number {
    let max = -Infinity;
    for (let i = this.times.length - 1; i >= 0 && this.times[i] >= since; i--) max = Math.max(max, this.levels[i]);
    return max === -Infinity ? this.levels[this.levels.length - 1] : max;
  }

  // Hann-windowed single-bin DFT magnitude at the tracked frequency, in dB.
  private blockLevel(x: Float32Array, start: number): number {
    const len = this.blockLength;
    const w = (2 * Math.PI * this.freq) / this.sampleRate;
    let re = 0;
    let im = 0;
    for (let i = 0; i < len; i++) {
      const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1));
      const v = x[start + i] * win;
      re += v * Math.cos(w * i);
      im -= v * Math.sin(w * i);
    }
    return 10 * Math.log10(((re * re + im * im) * 16) / (len * len) + 1e-20);
  }
}
