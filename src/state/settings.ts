import { useCallback, useState } from 'react';

// Per-device UI preferences. Browser storage can be unavailable (private
// mode, blocked site data), so every access is guarded.
export interface Settings {
  showSpectrum: boolean;
  primerSeen: boolean;
  currentPianoId: string | null;
  backupDue: boolean;
}

const KEY = 'piano-tuner:settings';
const DEFAULTS: Settings = { showSpectrum: false, primerSeen: false, currentPianoId: null, backupDue: false };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function store(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Settings just won't persist.
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(load);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      store(next);
      return next;
    });
  }, []);
  return [settings, update];
}
