import { useCallback, useMemo } from 'react';
import { UpdateBanner } from '../components/UpdateBanner';
import { CheckScreen } from '../screens/Check';
import { Home } from '../screens/Home';
import { Learn } from '../screens/Learn';
import { PianosScreen } from '../screens/Pianos';
import { SettingsScreen } from '../screens/Settings';
import { TuneScreen } from '../screens/Tune';
import { useSettings } from '../state/settings';
import { usePianos } from '../state/usePianos';
import type { Piano } from '../storage/schema';
import { AppContext, type AppContextValue, type Route } from './context';
import { useHashRoute } from './router';

const TITLES: Record<Route, string> = {
  home: 'Piano Tuner',
  check: 'Check my piano',
  tune: 'Touch-up tuning',
  raise: 'Pitch raise',
  pianos: 'Pianos & backup',
  settings: 'Settings',
  learn: 'Learn the basics',
};

export function App() {
  const store = usePianos();
  const [settings, updateSettings] = useSettings();
  const [route, navigate] = useHashRoute();

  const piano = store.pianos.find((p) => p.id === settings.currentPianoId) ?? store.pianos[0];
  const selectPiano = useCallback((id: string) => updateSettings({ currentPianoId: id }), [updateSettings]);
  const savePiano = useCallback((p: Piano) => store.save(p), [store]);

  const ctx = useMemo<AppContextValue | null>(
    () => (piano ? { store, piano, selectPiano, savePiano, settings, updateSettings, navigate } : null),
    [store, piano, selectPiano, savePiano, settings, updateSettings, navigate],
  );

  if (store.error) {
    return (
      <main>
        <div className="notice danger">{store.error}</div>
      </main>
    );
  }
  if (!store.loaded || !ctx) return <main className="muted">Loading…</main>;

  // First run: show the primer before anything else.
  const effectiveRoute: Route = !settings.primerSeen ? 'learn' : route;

  return (
    <AppContext.Provider value={ctx}>
      <header className="app-header">
        {effectiveRoute !== 'home' && settings.primerSeen ? (
          <button className="icon ghost" aria-label="Back" onClick={() => (history.length > 1 ? history.back() : navigate('home'))}>
            ←
          </button>
        ) : null}
        <div className="title">
          {TITLES[effectiveRoute]}
          {effectiveRoute !== 'pianos' && effectiveRoute !== 'learn' ? <small>{ctx.piano.name}</small> : null}
        </div>
        {effectiveRoute === 'home' ? (
          <button className="icon ghost" aria-label="Settings" onClick={() => navigate('settings')}>
            ⚙
          </button>
        ) : null}
      </header>
      <UpdateBanner />
      <main>
        {effectiveRoute === 'home' && <Home />}
        {effectiveRoute === 'check' && <CheckScreen />}
        {effectiveRoute === 'tune' && <TuneScreen key="tune" mode="touch-up" />}
        {effectiveRoute === 'raise' && <TuneScreen key="raise" mode="pitch-raise" />}
        {effectiveRoute === 'pianos' && <PianosScreen />}
        {effectiveRoute === 'settings' && <SettingsScreen />}
        {effectiveRoute === 'learn' && <Learn />}
      </main>
    </AppContext.Provider>
  );
}
