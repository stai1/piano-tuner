import { useState } from 'react';
import { useApp } from '../app/context';
import { STRETCH_STYLES, type StretchStyle } from '../dsp/curve';

const STRETCH_LABEL: Record<StretchStyle, string> = {
  narrow: 'Narrow (less stretch)',
  standard: 'Standard',
  wide: 'Wide (more stretch)',
};

export function SettingsScreen() {
  const { piano, savePiano, settings, updateSettings, navigate } = useApp();
  const [a4, setA4] = useState(String(piano.a4Hz));
  const a4Value = Number(a4);
  const a4Valid = Number.isFinite(a4Value) && a4Value >= 400 && a4Value <= 480;

  return (
    <div className="stack">
      <section className="card stack">
        <label className="toggle">
          <span>
            <strong>Advanced mode</strong>
            <br />
            <span className="small muted">Reference pitch and stretch settings for each piano.</span>
          </span>
          <input type="checkbox" checked={settings.advanced} onChange={(e) => updateSettings({ advanced: e.target.checked })} />
        </label>
      </section>

      {settings.advanced ? (
        <section className="card stack">
          <h2 style={{ margin: 0 }}>{piano.name}</h2>
          <label className="field">
            Reference pitch (A4, Hz)
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input inputMode="decimal" value={a4} onChange={(e) => setA4(e.target.value)} aria-invalid={!a4Valid} />
              <button disabled={!a4Valid || a4Value === piano.a4Hz} onClick={() => savePiano({ ...piano, a4Hz: a4Value })}>
                Save
              </button>
            </div>
            <span className="hint">
              440 is the standard. Some ensembles use 442. Range 400–480. Checks after a change are measured against the new pitch.
            </span>
          </label>
          <label className="field">
            Stretch
            <select value={piano.stretch} onChange={(e) => savePiano({ ...piano, stretch: e.target.value as StretchStyle })}>
              {STRETCH_STYLES.map((s) => (
                <option key={s} value={s}>
                  {STRETCH_LABEL[s]}
                </option>
              ))}
            </select>
            <span className="hint">
              How much the treble is tuned sharp and the bass flat to match the piano's overtones. Standard suits most pianos.
            </span>
          </label>
        </section>
      ) : null}

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Privacy</h2>
        <p className="small" style={{ margin: 0 }}>
          Everything stays on this device. Sound from the microphone is analyzed in the browser and never recorded or sent
          anywhere, and the app makes no network requests after it loads.
        </p>
      </section>

      <button className="block" onClick={() => navigate('learn')}>
        Learn the basics
      </button>
    </div>
  );
}
