// Keys are indexed 0..87 from A0 to C8.
export const KEY_COUNT = 88;
export const A4_KEY = 48;
export const DEFAULT_A4_HZ = 440;

const NAMES = ['A', 'A♯', 'B', 'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯'];

export function keyName(key: number): string {
  return NAMES[key % 12] + keyOctave(key);
}

export function keyPitchClass(key: number): string {
  return NAMES[key % 12];
}

export function keyOctave(key: number): number {
  return Math.floor((key + 9) / 12);
}

export function isBlackKey(key: number): boolean {
  return NAMES[key % 12].includes('♯');
}

export function etFrequency(key: number, a4Hz = DEFAULT_A4_HZ): number {
  return a4Hz * 2 ** ((key - A4_KEY) / 12);
}

export function cents(freq: number, ref: number): number {
  return 1200 * Math.log2(freq / ref);
}

export function shiftCents(freq: number, c: number): number {
  return freq * 2 ** (c / 1200);
}

// Frequency of partial n of a stiff string with fundamental parameter f0.
export function partialFrequency(f0: number, n: number, b: number): number {
  return n * f0 * Math.sqrt(1 + b * n * n);
}

export function clampKey(key: number): number {
  return Math.max(0, Math.min(KEY_COUNT - 1, Math.round(key)));
}
