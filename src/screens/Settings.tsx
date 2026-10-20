import { useMemo, useState } from 'react';
import { useApp } from '../app/context';
import { CurveEditor } from '../components/CurveEditor';
import { inharmonicityCurve } from '../tuning/model';

export function SettingsScreen() {
  const { piano, savePiano, navigate } = useApp();
  const [a4, setA4] = useState(String(piano.a4Hz));
  const a4Value = Number(a4);
  const a4Valid = Number.isFinite(a4Value) && a4Value >= 400 && a4Value <= 480;
  const b = useMemo(() => inharmonicityCurve(piano), [piano]);

  return (
    <div className="stack">
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
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Tuning curve</h2>
        <p className="small muted" style={{ margin: 0 }}>
          How far each key's target sits from plain equal temperament. Piano strings' overtones run sharp, so octaves are
          stretched: the treble is tuned a little sharp and the bass a little flat. Drag a handle to change the octave type
          there (which overtones line up, e.g. 4:2). The curve is computed from this piano's measured strings, so it stays
          smooth. Standard suits most pianos.
        </p>
        <CurveEditor b={b} a4Hz={piano.a4Hz} value={piano.octaveTypes} onChange={(octaveTypes) => savePiano({ ...piano, octaveTypes })} />
        {piano.inharmonicity.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            This piano hasn't been checked yet, so the curve uses typical string values. It will fit this piano after a check.
          </p>
        ) : null}
      </section>

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
