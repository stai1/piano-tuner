import { useCallback, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/context';
import type { TunerResult } from '../audio/messages';
import { CheckChart, formatCents } from '../components/CheckChart';
import { Gauge, tone } from '../components/Gauge';
import { KeyboardStrip } from '../components/KeyboardStrip';
import { computeCurve } from '../dsp/curve';
import { deviationCents } from '../dsp/analyzer';
import { interpolateInharmonicity } from '../dsp/inharmonicity';
import { keyName } from '../dsp/notes';
import { useTuner } from '../state/useTuner';
import type { Check, InharmonicityReading } from '../storage/schema';
import { summarizeCheck } from '../tuning/check';
import { CHECK_KEYS, analysisConfig, centsFromCurve, readingToF0, referenceCurve } from '../tuning/model';
import { ReadingHistory } from '../tuning/steady';
import { VERDICT_LABEL, VERDICT_TONE, verdictText } from '../tuning/verdict';

interface Collected {
  key: number;
  // Fundamental parameter that reads 0 cents; null when skipped.
  f0: number | null;
  b: number | null;
  beatHz: number | null;
  depthDb: number;
}

// Hold long enough to hear beating between the strings, except in the
// treble where notes die away quickly.
function minListenMs(key: number): number {
  return key >= 72 ? 0 : 1300;
}

// A check only needs a few cents of precision (it takes the median), so it
// accepts more wander than tuning, especially from beating treble strings.
function checkSpread(key: number): number {
  return key >= 60 ? 5 : 2.5;
}

export function CheckScreen() {
  const { piano, savePiano, updateSettings, navigate } = useApp();
  const curve = useMemo(() => referenceCurve(piano), [piano]);
  const [step, setStep] = useState(0);
  const [collected, setCollected] = useState<Collected[]>([]);
  const [live, setLive] = useState<{ cents: number | null; hint: string | null }>({ cents: null, hint: null });
  const [accepted, setAccepted] = useState(false);
  const [result, setResult] = useState<Check | null>(null);
  const history = useRef(new ReadingHistory(CHECK_KEYS[0]));
  const target = CHECK_KEYS[step];

  // Center detection on where the piano seems to sit so far.
  const measured = collected.filter((c) => c.f0 !== null);
  const runningOffset =
    measured.length > 0 ? measured.reduce((a, c) => a + centsFromCurve(curve, c.key, c.f0!), 0) / measured.length : 0;
  const config = useMemo(() => analysisConfig(curve, Math.round(runningOffset), null), [curve, Math.round(runningOffset)]);

  const finish = useCallback(
    async (all: Collected[]) => {
      tuner.stop();
      const now = new Date().toISOString();
      const readings: InharmonicityReading[] = all
        .filter((c) => c.b !== null)
        .map((c) => ({ key: c.key, b: c.b!, measuredAt: now }));
      const inharmonicity = [
        ...piano.inharmonicity.filter((r) => !readings.some((n) => n.key === r.key)),
        ...readings,
      ].sort((a, b) => a.key - b.key);
      const newCurve = computeCurve(
        interpolateInharmonicity(new Map(inharmonicity.map((r) => [r.key, r.b]))),
        piano.a4Hz,
        piano.octaveTypes,
      );
      const notes = all.map((c) => ({
        key: c.key,
        cents: c.f0 === null ? null : centsFromCurve(newCurve, c.key, c.f0),
        beatHz: c.beatHz,
        depthDb: c.depthDb,
      }));
      const summary = summarizeCheck(notes);
      if (!summary) {
        setResult(null);
        setStep(CHECK_KEYS.length);
        return;
      }
      const check: Check = {
        id: crypto.randomUUID(),
        date: now,
        averageCents: summary.averageCents,
        verdict: summary.verdict,
        notes,
      };
      await savePiano({ ...piano, inharmonicity, checks: [...piano.checks, check].slice(-20) });
      updateSettings({ backupDue: true });
      setResult(check);
      setStep(CHECK_KEYS.length);
    },
    [piano, savePiano, updateSettings],
  );

  const advance = useCallback(
    (entry: Collected) => {
      const all = [...collected.filter((c) => c.key !== entry.key), entry].sort((a, b) => a.key - b.key);
      setCollected(all);
      setAccepted(false);
      setLive({ cents: null, hint: null });
      const next = step + 1;
      if (next >= CHECK_KEYS.length) {
        finish(all);
      } else {
        history.current = new ReadingHistory(CHECK_KEYS[next]);
        setStep(next);
      }
    },
    [collected, step, finish],
  );

  const onResult = useCallback(
    (r: TunerResult) => {
      if (accepted || step >= CHECK_KEYS.length) return;
      const m = r.measurement;
      if (!r.active || !m) return;
      // Within a key of the asked note is accepted: a piano far off pitch can
      // sound closer to its neighbor.
      if (Math.abs(m.key - target) > 1) {
        setLive({ cents: null, hint: `That sounds like ${keyName(m.key)}. Play ${keyName(target)}.` });
        return;
      }
      const dev = deviationCents(m, curve.f0[m.key], curve.b[m.key]);
      const c = centsFromCurve(curve, target, readingToF0(curve.f0[m.key], dev));
      const h = history.current;
      h.add({ time: r.time, cents: c, b: m.key === target ? m.b : null });
      setLive({ cents: h.value() ?? c, hint: null });
      if (h.steady(checkSpread(target)) && h.age(r.time) >= minListenMs(target)) {
        const value = h.value()!;
        setAccepted(true);
        const entry: Collected = {
          key: target,
          f0: readingToF0(curve.f0[target], value),
          b: h.inharmonicity(),
          beatHz: r.beat?.beatHz ?? null,
          depthDb: r.beat?.depthDb ?? 0,
        };
        setTimeout(() => advance(entry), 700);
      }
    },
    [accepted, step, target, curve, advance],
  );

  const tuner = useTuner(config, onResult);

  const skip = () => advance({ key: target, f0: null, b: null, beatHz: null, depthDb: 0 });
  const back = () => {
    if (step === 0) return;
    history.current = new ReadingHistory(CHECK_KEYS[step - 1]);
    setAccepted(false);
    setStep(step - 1);
  };

  if (step >= CHECK_KEYS.length) {
    return (
      <div className="stack">
        {result ? (
          <section className="card stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Result</h2>
              <span className={`badge ${VERDICT_TONE[result.verdict]}`}>{VERDICT_LABEL[result.verdict]}</span>
            </div>
            <p style={{ margin: 0 }}>{verdictText(result, piano.a4Hz)}</p>
            <CheckChart check={result} />
            <CheckFlags check={result} />
          </section>
        ) : (
          <div className="notice warn">No notes were measured, so there is no result. Try again somewhere quieter.</div>
        )}
        <div className="actions two">
          {result && (result.verdict === 'pitch-raise' || result.verdict === 'large-pitch-raise') ? (
            <button className="action primary" onClick={() => navigate('raise')}>
              <strong>Start a pitch raise</strong>
              <span>Bring the piano to A{piano.a4Hz}.</span>
            </button>
          ) : null}
          {result ? (
            <button
              className={`action${result.verdict === 'touch-up' || result.verdict === 'in-tune' ? ' primary' : ''}`}
              onClick={() => navigate('tune')}
            >
              <strong>Touch-up tuning</strong>
              <span>Fix notes and unisons at the current pitch.</span>
            </button>
          ) : null}
          <button className="action" onClick={() => navigate('home')}>
            <strong>Done</strong>
            <span>Back to the start.</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tuner-layout">
      <section className="card stack">
        <div className="readout">
          <div className="muted small">
            Note {step + 1} of {CHECK_KEYS.length}
          </div>
          <div className="note">{keyName(target)}</div>
          <Gauge cents={live.cents} dim={!tuner.listening} />
          <div className={`cents ${accepted ? 'tone-ok' : tone(live.cents)}`}>
            {accepted ? 'Got it ✓' : live.cents === null ? '—' : formatCents(live.cents)}
          </div>
          <div className="direction muted">
            {!tuner.listening
              ? 'Press Start, then play the note.'
              : live.hint ?? (live.cents === null ? `Play ${keyName(target)} firmly and let it ring.` : 'Hold… let it ring.')}
          </div>
        </div>
        <KeyboardStrip current={target} done={new Set(collected.filter((c) => c.f0 !== null).map((c) => c.key))} />
      </section>

      <section className="stack">
        {tuner.error ? <div className="notice danger">{tuner.error}</div> : null}
        {!tuner.listening ? (
          <button className="primary block" disabled={tuner.starting} onClick={tuner.start}>
            {tuner.starting ? 'Starting…' : step === 0 ? 'Start' : 'Resume'}
          </button>
        ) : (
          <div className="row">
            <button onClick={back} disabled={step === 0}>
              Previous
            </button>
            <button onClick={skip}>Skip note</button>
            <button className="ghost" onClick={tuner.stop}>
              Pause
            </button>
          </div>
        )}
        <div className="card small">
          <h3>How to check</h3>
          <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
            <li>Find a quiet moment. Put your phone or laptop on the music desk, or close to the strings.</li>
            <li>Play each note firmly (not too loud) and hold the key down until the app moves on.</li>
            <li>If a note gives no reading after a few tries, skip it.</li>
          </ul>
          <details className="info">
            <summary>Why these notes?</summary>
            <p>
              One note per octave is enough to measure how stiff this piano's strings are (inharmonicity) and how far the
              whole piano has drifted. The app uses this to set a tuning target that suits this piano.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}

function CheckFlags({ check }: { check: Check }) {
  const summary = summarizeCheck(check.notes);
  if (!summary) return null;
  const list = (keys: number[]) => keys.map(keyName).join(', ');
  const items: string[] = [];
  if (summary.outliers.length) items.push(`Far from the rest: ${list(summary.outliers)}. Tune these first.`);
  if (summary.unisonSuspects.length) {
    items.push(`Strings disagree (audible beating): ${list(summary.unisonSuspects)}. Use the unison helper when tuning.`);
  }
  if (summary.missing.length) items.push(`No reading: ${list(summary.missing)}.`);
  if (items.length === 0) return null;
  return (
    <ul className="small" style={{ margin: 0, paddingLeft: '1.2em' }}>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}
