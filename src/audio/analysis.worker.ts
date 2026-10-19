/// <reference lib="webworker" />
import { Analyzer, rmsDb } from '../dsp/analyzer';
import { BeatTracker } from '../dsp/beats';
import { partialFrequency } from '../dsp/notes';
import type { AnalysisConfig, FromWorker, ToWorker, TunerResult } from './messages';

declare const self: DedicatedWorkerGlobalScope;

const BUFFER_SECONDS = 1;
// Consecutive detections needed before switching to a different key.
const SWITCH_FRAMES = 2;
// Level above the tracked room-noise floor that counts as a note.
const GATE_DB = 12;

let analyzer: Analyzer | null = null;
let beats: BeatTracker | null = null;
let config: AnalysisConfig | null = null;
let ring = new Float32Array(0);
let filled = 0;
let pendingSamples = 0;
let scheduled = false;

let followedKey: number | null = null;
let candidate: number | null = null;
let candidateCount = 0;
let noiseFloorDb = -90;
let beatKey: number | null = null;
// Last measured pitch of the key being measured, so its partials can be
// followed through large changes (e.g. during a pitch raise).
let trackedKey: number | null = null;
let trackedF0: number | null = null;

function post(msg: FromWorker) {
  self.postMessage(msg);
}

function append(chunk: Float32Array) {
  if (chunk.length >= ring.length) {
    ring.set(chunk.subarray(chunk.length - ring.length));
  } else {
    ring.copyWithin(0, chunk.length);
    ring.set(chunk, ring.length - chunk.length);
  }
  filled = Math.min(ring.length, filled + chunk.length);
  pendingSamples += chunk.length;
  beats?.push(chunk);
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  // Let queued sample messages land first so we always analyze the newest audio.
  setTimeout(run, 0);
}

function followKey(detected: number | null): number | null {
  if (detected === null) return followedKey;
  if (followedKey === null || detected === followedKey) {
    followedKey = detected;
    candidate = null;
    candidateCount = 0;
    return followedKey;
  }
  if (detected === candidate) candidateCount++;
  else {
    candidate = detected;
    candidateCount = 1;
  }
  if (candidateCount >= SWITCH_FRAMES) {
    followedKey = detected;
    candidate = null;
    candidateCount = 0;
  }
  return followedKey;
}

function run() {
  scheduled = false;
  if (!analyzer || !config || pendingSamples === 0) return;
  pendingSamples = 0;
  const samples = ring.subarray(ring.length - filled);
  const opts = { refF0: config.refF0, b: config.b };
  const levelDb = rmsDb(samples, Math.min(samples.length, Math.round(analyzer.sampleRate * 0.1)));

  // Follow the quietest recent level as the room's noise floor.
  noiseFloorDb = levelDb < noiseFloorDb ? levelDb : noiseFloorDb + 0.02;
  const active = levelDb > Math.max(-75, noiseFloorDb + GATE_DB);

  let detectedKey: number | null = null;
  let key: number | null = config.lockedKey ?? followedKey;
  let measurement = null;
  if (active) {
    detectedKey = analyzer.detect(samples, opts);
    key = config.lockedKey ?? followKey(detectedKey);
    if (key !== null) {
      if (key !== trackedKey) trackedF0 = null;
      trackedKey = key;
      measurement = analyzer.measure(samples, key, trackedF0 ?? config.refF0[key], config.b[key]);
      if (measurement) trackedF0 = measurement.f0;
    }
  }

  if (measurement && beats) {
    // Follow the strongest partial for beating between unison strings.
    const strongest = measurement.partials.reduce((a, p) => (p.strength > a.strength ? p : a));
    if (beatKey !== measurement.key) beats.reset();
    beatKey = measurement.key;
    beats.setFrequency(strongest.freq, partialFrequency(measurement.f0, 1, measurement.b ?? config.b[measurement.key]));
  }

  const result: TunerResult = {
    time: performance.now(),
    levelDb,
    active,
    key,
    detectedKey,
    measurement,
    beat: active && beats ? beats.estimate() : null,
  };
  post({ type: 'result', result });
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === 'config') {
    if (config && config.lockedKey !== msg.config.lockedKey) {
      beats?.reset();
      trackedF0 = null;
    }
    config = msg.config;
  } else if (msg.type === 'port') {
    msg.port.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { type: 'sampleRate'; sampleRate: number } | { type: 'samples'; samples: Float32Array };
      if (data.type === 'sampleRate') {
        analyzer = new Analyzer(data.sampleRate);
        beats = new BeatTracker(data.sampleRate);
        ring = new Float32Array(Math.round(data.sampleRate * BUFFER_SECONDS));
        filled = 0;
        post({ type: 'ready', sampleRate: data.sampleRate });
      } else {
        append(data.samples);
        schedule();
      }
    };
  }
};
