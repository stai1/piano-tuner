import { useCallback, useEffect, useRef, useState } from 'react';
import { MicrophoneError, TunerEngine } from '../audio/engine';
import type { AnalysisConfig, TunerResult } from '../audio/messages';

export interface TunerState {
  listening: boolean;
  starting: boolean;
  error: string | null;
  result: TunerResult | null;
  start: () => Promise<void>;
  stop: () => void;
}

// Owns one TunerEngine for the lifetime of the component.
export function useTuner(config: AnalysisConfig, onResult?: (r: TunerResult) => void): TunerState {
  const engineRef = useRef<TunerEngine | null>(null);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TunerResult | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  if (!engineRef.current) engineRef.current = new TunerEngine();
  const engine = engineRef.current;

  useEffect(() => {
    engine.onResult = (r) => {
      setResult(r);
      onResultRef.current?.(r);
    };
  }, [engine]);

  useEffect(() => {
    engine.configure(config);
  }, [engine, config]);

  useEffect(() => () => engine.stop(), [engine]);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      await engine.start();
      setListening(true);
    } catch (err) {
      engine.stop();
      setError(err instanceof MicrophoneError ? err.message : 'The microphone could not be started.');
    } finally {
      setStarting(false);
    }
  }, [engine]);

  const stop = useCallback(() => {
    engine.stop();
    setListening(false);
    setResult(null);
  }, [engine]);

  return { listening, starting, error, result, start, stop };
}
