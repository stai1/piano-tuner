// Development-only audio sources, loaded by the engine only when
// import.meta.env.DEV is true, so neither this code nor the samples it fetches
// ship in production builds. Both play Salamander samples from test-samples/
// (see scripts/prepare-samples.sh) into the analysis input. The microphone is
// muted while they sound, so their sound from the speakers doesn't re-enter
// the analysis.

import { KEY_COUNT, keyName } from '../dsp/notes';

const SAMPLE_NAMES = [
  'A0',
  ...[1, 2, 3, 4, 5, 6, 7].flatMap((o) => [`C${o}`, `Ds${o}`, `Fs${o}`, `A${o}`]),
  'C8',
];

const PITCH_CLASS: Record<string, number> = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };

function sampleKey(name: string): number {
  const [, pc, octave] = /^([A-G]s?)(\d)$/.exec(name)!;
  return 12 * Number(octave) + PITCH_CLASS[pc] - 9;
}

async function loadSamples(context: AudioContext, names: string[]): Promise<Map<number, AudioBuffer>> {
  const out = new Map<number, AudioBuffer>();
  await Promise.all(
    names.map(async (name) => {
      const res = await fetch(`/test-samples/${name}.wav`);
      if (!res.ok) throw new Error(`Missing test-samples/${name}.wav. Run \`npm run samples\`.`);
      out.set(sampleKey(name), await context.decodeAudioData(await res.arrayBuffer()));
    }),
  );
  return out;
}

// Sample nearest to key, and the playback detune (cents) that shifts it there.
function nearest(samples: Map<number, AudioBuffer>, key: number): [AudioBuffer, number] {
  let best = -1;
  for (const k of samples.keys()) if (best < 0 || Math.abs(k - key) < Math.abs(best - key)) best = k;
  return [samples.get(best)!, (key - best) * 100];
}

// Keys "awsedftgyhujkolp;'" play a chromatic run from C upward, like a piano
// keyboard laid over the home row; digits 0–9 choose the octave of that C.
const NOTE_CODES = [
  'KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY',
  'KeyH', 'KeyU', 'KeyJ', 'KeyK', 'KeyO', 'KeyL', 'KeyP', 'Semicolon', 'Quote',
];
const RELEASE_SECONDS = 0.3;
// Keep the microphone muted this long after the last dev note, for room echo.
const MIC_TAIL_MS = 300;

// Mutes the microphone while any dev voice is sounding.
class MicGate {
  private voices = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly context: AudioContext,
    private readonly mic: GainNode,
  ) {}

  started(src: AudioBufferSourceNode): void {
    this.voices++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.mic.gain.setTargetAtTime(0, this.context.currentTime, 0.005);
    src.addEventListener('ended', () => this.ended());
  }

  private ended(): void {
    this.voices = Math.max(0, this.voices - 1);
    if (this.voices > 0) return;
    this.timer = setTimeout(() => {
      if (this.voices === 0) this.mic.gain.setTargetAtTime(1, this.context.currentTime, 0.005);
    }, MIC_TAIL_MS);
  }

  release(): void {
    if (this.timer) clearTimeout(this.timer);
    this.mic.gain.cancelScheduledValues(this.context.currentTime);
    this.mic.gain.value = 1;
  }
}

function typingInField(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

function attachKeyboard(context: AudioContext, samples: Map<number, AudioBuffer>, out: AudioNode, gate: MicGate): () => void {
  let octave = 4;
  const playing = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();

  const release = (code: string) => {
    const voice = playing.get(code);
    if (!voice) return;
    playing.delete(code);
    const t = context.currentTime;
    voice.gain.gain.setTargetAtTime(0, t, RELEASE_SECONDS / 4);
    voice.src.stop(t + RELEASE_SECONDS);
  };

  const onDown = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typingInField(e)) return;
    const digit = /^Digit(\d)$/.exec(e.code);
    if (digit) {
      octave = Number(digit[1]);
      console.info(`[dev keyboard] "a" is now C${octave}`);
      return;
    }
    const offset = NOTE_CODES.indexOf(e.code);
    if (offset < 0) return;
    e.preventDefault();
    const key = 12 * octave - 9 + offset;
    if (key < 0 || key >= KEY_COUNT) return;
    release(e.code);
    const [buffer, detune] = nearest(samples, key);
    const src = context.createBufferSource();
    src.buffer = buffer;
    src.detune.value = detune;
    const gain = context.createGain();
    gain.gain.value = 0.8;
    src.connect(gain).connect(out);
    src.start();
    src.onended = () => gain.disconnect();
    gate.started(src);
    playing.set(e.code, { src, gain });
    console.info(`[dev keyboard] ${keyName(key)}`);
  };
  const onUp = (e: KeyboardEvent) => release(e.code);
  const onBlur = () => [...playing.keys()].forEach(release);

  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  console.info('[dev keyboard] Keys "awsedftgyhujkolp;\'" play notes from C4 (digits 0–9 set the octave).');
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
    window.removeEventListener('blur', onBlur);
    onBlur();
  };
}

// `?simulate=A4` (or `?simulate=A4,C5`) strikes the listed samples in turn,
// one every 4 seconds; `&detune=-40` plays them 40 cents flat.
function attachSimulation(
  context: AudioContext,
  samples: Map<number, AudioBuffer>,
  spec: string,
  out: AudioNode,
  gate: MicGate,
): () => void {
  const keys = spec.split(',').map((n) => sampleKey(n.trim().replace('#', 's')));
  const detune = Number(new URLSearchParams(location.search).get('detune') ?? 0);
  let i = 0;
  const strike = () => {
    const src = context.createBufferSource();
    src.buffer = samples.get(keys[i++ % keys.length]) ?? null;
    src.detune.value = detune;
    src.connect(out);
    src.start();
    gate.started(src);
  };
  strike();
  const timer = setInterval(strike, 4000);
  return () => clearInterval(timer);
}

// Mixes dev sources into the analysis input and the speakers, muting `mic`
// while they sound. Returns a function that detaches them.
export async function attachDevInput(context: AudioContext, analysisInput: AudioNode, mic: GainNode): Promise<() => void> {
  const simulate = new URLSearchParams(location.search).get('simulate');
  let samples: Map<number, AudioBuffer>;
  try {
    samples = await loadSamples(context, SAMPLE_NAMES);
  } catch (err) {
    console.warn(`[dev keyboard] ${(err as Error).message}`);
    return () => {};
  }
  const bus = context.createGain();
  bus.connect(analysisInput);
  const speakers = context.createGain();
  speakers.connect(context.destination);

  bus.connect(speakers);
  const gate = new MicGate(context, mic);
  const detachKeyboard = attachKeyboard(context, samples, bus, gate);
  const detachSimulation = simulate ? attachSimulation(context, samples, simulate, bus, gate) : () => {};
  return () => {
    detachKeyboard();
    detachSimulation();
    gate.release();
    bus.disconnect();
    speakers.disconnect();
  };
}
