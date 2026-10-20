import type { TunerState } from '../state/useTuner';

// Start/stop control for the microphone, with any microphone error.
export function ListenButton({ tuner, startLabel = 'Start' }: { tuner: TunerState; startLabel?: string }) {
  return (
    <>
      {tuner.error ? <div className="notice danger">{tuner.error}</div> : null}
      {tuner.listening ? (
        <button className="block" onClick={tuner.stop}>
          Stop listening
        </button>
      ) : (
        <button className="primary block" disabled={tuner.starting} onClick={tuner.start}>
          {tuner.starting ? 'Starting…' : startLabel}
        </button>
      )}
    </>
  );
}
