// Collects readings of one note and decides when they have settled.
export interface Reading {
  time: number;
  cents: number;
  b: number | null;
}

const WINDOW_MS = 700;
const MIN_READINGS = 5;

// Treble trichords make readings wander more, so allow a wider spread there.
export function steadySpread(key: number): number {
  return key >= 72 ? 3 : 1.5;
}

export function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export class ReadingHistory {
  private readings: Reading[] = [];
  firstTime: number | null = null;

  constructor(readonly key: number) {}

  add(r: Reading): void {
    this.firstTime ??= r.time;
    this.readings.push(r);
    const cutoff = r.time - 3000;
    while (this.readings.length > 0 && this.readings[0].time < cutoff) this.readings.shift();
  }

  private recent(): Reading[] {
    const last = this.readings[this.readings.length - 1];
    return last ? this.readings.filter((r) => r.time >= last.time - WINDOW_MS) : [];
  }

  // Median of the last moment of readings, or null with too few.
  value(): number | null {
    const recent = this.recent();
    return recent.length >= MIN_READINGS ? median(recent.map((r) => r.cents)) : null;
  }

  steady(spread = steadySpread(this.key)): boolean {
    const recent = this.recent();
    if (recent.length < MIN_READINGS) return false;
    const c = recent.map((r) => r.cents);
    return Math.max(...c) - Math.min(...c) <= spread;
  }

  inharmonicity(): number | null {
    const b = this.readings.map((r) => r.b).filter((x): x is number => x !== null);
    return b.length >= 3 ? median(b) : null;
  }

  // Milliseconds since the first reading.
  age(now: number): number {
    return this.firstTime === null ? 0 : now - this.firstTime;
  }
}
