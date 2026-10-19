// Runs on the audio thread: batches microphone samples and sends them to the
// analysis worker over a MessagePort handed over at startup.

declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

const BATCH = 2048;

class CaptureProcessor extends AudioWorkletProcessor {
  private out: MessagePort | null = null;
  private buffer = new Float32Array(BATCH);
  private filled = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<{ port: MessagePort }>) => {
      this.out = e.data.port;
      this.out.postMessage({ type: 'sampleRate', sampleRate });
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel || !this.out) return true;
    let i = 0;
    while (i < channel.length) {
      const n = Math.min(channel.length - i, BATCH - this.filled);
      this.buffer.set(channel.subarray(i, i + n), this.filled);
      this.filled += n;
      i += n;
      if (this.filled === BATCH) {
        this.out.postMessage({ type: 'samples', samples: this.buffer }, [this.buffer.buffer]);
        this.buffer = new Float32Array(BATCH);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('capture', CaptureProcessor);
