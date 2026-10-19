import { createContext, useContext } from 'react';
import type { Settings } from '../state/settings';
import type { PianoStore } from '../state/usePianos';
import type { Piano } from '../storage/schema';

export type Route = 'home' | 'check' | 'tune' | 'raise' | 'pianos' | 'settings' | 'learn';

export interface AppContextValue {
  store: PianoStore;
  piano: Piano;
  selectPiano: (id: string) => void;
  savePiano: (piano: Piano) => Promise<Piano>;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  navigate: (route: Route) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppContext');
  return ctx;
}
