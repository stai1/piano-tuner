import type { BeatEstimate } from '../dsp/beats';
import type { Measurement } from '../dsp/analyzer';

export interface AnalysisConfig {
  refF0: number[];
  b: number[];
  // Measure this key instead of following the detected one.
  lockedKey: number | null;
  // Send a spectrum with each result.
  spectrum?: boolean;
}

// Spectrum downsampled to log-spaced bands between minHz and maxHz.
export interface SpectrumBands {
  db: Float32Array;
  minHz: number;
  maxHz: number;
}

export type ToWorker =
  | { type: 'port'; port: MessagePort }
  | { type: 'config'; config: AnalysisConfig };

export interface TunerResult {
  time: number;
  levelDb: number;
  // True while a note is sounding above the room noise.
  active: boolean;
  // Key being measured (locked or followed), and the raw detection.
  key: number | null;
  detectedKey: number | null;
  measurement: Measurement | null;
  beat: BeatEstimate | null;
  spectrum: SpectrumBands | null;
}

export type FromWorker = { type: 'result'; result: TunerResult } | { type: 'ready'; sampleRate: number };
