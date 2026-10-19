import workletUrl from './capture.worklet.ts?worker&url';
import type { AnalysisConfig, FromWorker, ToWorker, TunerResult } from './messages';

export class MicrophoneError extends Error {}

function describeError(err: unknown): string {
  if (!window.isSecureContext) return 'The microphone needs a secure (https) connection.';
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot use the microphone.';
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was blocked. Allow it in your browser settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found.';
  if (name === 'NotReadableError') return 'The microphone is in use by another app.';
  return 'The microphone could not be started.';
}

// Microphone capture plus off-main-thread analysis. Call start() from a user
// gesture (iOS only allows audio to start from one).
export class TunerEngine {
  onResult: (result: TunerResult) => void = () => {};
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private worker: Worker | null = null;
  private node: AudioWorkletNode | null = null;
  private config: AnalysisConfig | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private detachDev: (() => void) | null = null;

  get running(): boolean {
    return this.context !== null;
  }

  configure(config: AnalysisConfig): void {
    this.config = config;
    this.send({ type: 'config', config });
  }

  async start(): Promise<void> {
    if (this.context) return;
    // Development only: `?simulate=` replaces the microphone (see devInput.ts).
    const simulate = import.meta.env.DEV && new URLSearchParams(location.search).has('simulate');
    let stream: MediaStream | null = null;
    if (!simulate) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (err) {
        throw new MicrophoneError(describeError(err));
      }
    }
    const context = new AudioContext();
    await context.resume();
    await context.audioWorklet.addModule(workletUrl);

    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      if (e.data.type === 'result') this.onResult(e.data.result);
    };
    const node = new AudioWorkletNode(context, 'capture', { numberOfInputs: 1, numberOfOutputs: 0 });
    const channel = new MessageChannel();
    worker.postMessage({ type: 'port', port: channel.port2 } satisfies ToWorker, [channel.port2]);
    node.port.postMessage({ port: channel.port1 }, [channel.port1]);
    const mic = context.createGain();
    mic.connect(node);
    if (stream) context.createMediaStreamSource(stream).connect(mic);
    if (import.meta.env.DEV) {
      // Dev keyboard and sample simulation, mixed with the microphone (which
      // is muted while they sound so the speakers don't feed back).
      const { attachDevInput } = await import('./devInput');
      this.detachDev = await attachDevInput(context, node, mic);
    }

    this.context = context;
    this.stream = stream;
    this.worker = worker;
    this.node = node;
    if (this.config) this.send({ type: 'config', config: this.config });
    this.keepAwake();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  stop(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.detachDev?.();
    this.detachDev = null;
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.worker?.terminate();
    this.context?.close().catch(() => {});
    this.wakeLock?.release().catch(() => {});
    this.context = null;
    this.stream = null;
    this.worker = null;
    this.node = null;
    this.wakeLock = null;
  }

  private send(msg: ToWorker): void {
    this.worker?.postMessage(msg);
  }

  // Keeps the screen on while listening, where the browser supports it.
  private async keepAwake(): Promise<void> {
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      this.wakeLock = null;
    }
  }

  private onVisibility = () => {
    if (document.visibilityState === 'visible' && this.context) {
      this.context.resume().catch(() => {});
      this.keepAwake();
    }
  };
}
