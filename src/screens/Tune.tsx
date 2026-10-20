import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/context';
import type { TunerResult } from '../audio/messages';
import { formatCents } from '../components/CheckChart';
import { Gauge, tone } from '../components/Gauge';
import { KeyboardStrip } from '../components/KeyboardStrip';
import { Spectrum } from '../components/Spectrum';
import { deviationCents, maxPartials, partialDeviationCents } from '../dsp/analyzer';
import { shiftCurve } from '../dsp/curve';
import { KEY_COUNT, keyName } from '../dsp/notes';
import { useTuner } from '../state/useTuner';
import type { TuningSession } from '../storage/schema';
import { analysisConfig, currentOffsetCents, latestCheck, referenceCurve } from '../tuning/model';
import { overpullCents, passUsesOverpull, raiseWarning, recommendedPasses } from '../tuning/raise';
import { ReadingHistory } from '../tuning/steady';
import { THRESHOLDS, TUNED_TOLERANCE_CENTS } from '../tuning/thresholds';
import { formatA4 } from '../tuning/verdict';

type Mode = TuningSession['mode'];

export function TuneScreen({ mode }: { mode: Mode }) {
  const { piano, navigate } = useApp();
  const check = latestCheck(piano);
  if (!check) {
    return (
      <div className="card stack">
        <h2>Check the piano first</h2>
        <p>The check measures where your piano sits now and how its strings behave, so the tuning targets fit this piano.</p>
        <button className="primary" onClick={() => navigate('check')}>
          Check my piano
        </button>
      </div>
    );
  }
  const session = piano.session?.mode === mode ? piano.session : null;
  return session ? <Tuning session={session} /> : <Setup mode={mode} />;
}

function WarningBadge({ raiseCents }: { raiseCents: number }) {
  const w = raiseWarning(raiseCents);
  if (w === 'none') return null;
  return (
    <div className={`notice ${w === 'large' ? 'warn' : 'danger'}`} role="status">
      <strong>{w === 'large' ? 'Large raise' : 'Very large raise'}:</strong>{' '}
      {w === 'large' ? 'higher risk of broken strings.' : 'high risk of broken strings and an unstable result.'}
    </div>
  );
}

function Setup({ mode }: { mode: Mode }) {
  const { piano, savePiano } = useApp();
  const offset = currentOffsetCents(piano);
  const raise = -offset;
  const [passes, setPasses] = useState(recommendedPasses(raise));
  const other = piano.session && piano.session.mode !== mode ? piano.session : null;

  const start = () => {
    const session: TuningSession = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      mode,
      targetOffsetCents: mode === 'touch-up' ? offset : 0,
      raiseCents: mode === 'touch-up' ? 0 : raise,
      passes: mode === 'touch-up' ? 1 : passes,
      pass: 1,
      startOffsets: [],
      tuned: [],
    };
    savePiano({ ...piano, session });
  };

  return (
    <div className="stack">
      {mode === 'touch-up' ? (
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Touch-up at the current pitch</h2>
          <p style={{ margin: 0 }}>
            Targets follow the piano's current pitch ({formatA4(piano.a4Hz * 2 ** (offset / 1200))}, {formatCents(offset)} from{' '}
            {formatA4(piano.a4Hz)}), so you only fix the notes that stand out, without changing the tension of the whole piano.
          </p>
          {Math.abs(offset) > THRESHOLDS.touchUp.averageCents ? (
            <div className="notice warn">
              Your last check suggests a pitch raise. A touch-up still works, but the piano will stay{' '}
              {offset < 0 ? 'flat' : 'sharp'}.
            </div>
          ) : null}
        </section>
      ) : (
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Pitch raise to A{piano.a4Hz}</h2>
          <p style={{ margin: 0 }}>
            Planned change: <strong>{formatCents(raise)}</strong> on average ({raise >= 0 ? 'raising' : 'lowering'} pitch).
          </p>
          <WarningBadge raiseCents={raise} />
          <label className="field">
            Passes
            <select value={passes} onChange={(e) => setPasses(Number(e.target.value))}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'pass' : 'passes'}
                  {n === recommendedPasses(raise) ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
            <span className="hint">
              Every pass but the last aims a little past pitch (overpull), because tightening later strings pulls the earlier
              ones flat again. The last pass is the fine tuning.
            </span>
          </label>
        </section>
      )}
      {other ? (
        <div className="notice">Starting this replaces the {other.mode === 'pitch-raise' ? 'pitch raise' : 'touch-up'} in progress.</div>
      ) : null}
      <button className="primary block" onClick={start}>
        {mode === 'touch-up' ? 'Start touch-up' : 'Start pitch raise'}
      </button>
    </div>
  );
}

function Tuning({ session }: { session: TuningSession }) {
  const { piano, savePiano, settings, updateSettings, navigate } = useApp();
  const base = useMemo(() => referenceCurve(piano), [piano]);
  const target = useMemo(() => shiftCurve(base, session.targetOffsetCents), [base, session.targetOffsetCents]);
  const rough = session.mode === 'pitch-raise' && passUsesOverpull(session.pass, session.passes);

  const [locked, setLocked] = useState<number | null>(null);
  const [unison, setUnison] = useState(false);
  // Overtone the needle reads: null averages all measured partials.
  const [partial, setPartial] = useState<number | null>(null);
  const [partialMissing, setPartialMissing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [reading, setReading] = useState<{ key: number; final: number; steady: boolean } | null>(null);
  const [recentered, setRecentered] = useState(false);
  const history = useRef<ReadingHistory | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Center note detection between where the notes start and where they end
  // up on a first raise pass; partials are then followed as they move.
  const gridOffset =
    session.mode === 'pitch-raise' && session.pass === 1
      ? (currentOffsetCents(piano) + session.targetOffsetCents) / 2
      : session.targetOffsetCents;
  const config = useMemo(
    () => ({ ...analysisConfig(base, Math.round(gridOffset), locked), spectrum: settings.showSpectrum }),
    [base, Math.round(gridOffset), locked, settings.showSpectrum],
  );

  const startOffsets = useMemo(() => new Map(session.startOffsets.map((s) => [s.key, s.cents])), [session.startOffsets]);
  const tuned = useMemo(() => new Set(session.tuned), [session.tuned]);

  const updateSession = useCallback(
    (patch: Partial<TuningSession>) => {
      const next = { ...sessionRef.current, ...patch };
      sessionRef.current = next;
      savePiano({ ...piano, session: next });
    },
    [piano, savePiano],
  );

  // A touch-up follows the piano's pitch from its latest check. If that has
  // changed since the session started (a new check, or a new reference
  // pitch), re-center, and clear the marks made against the old center.
  const latestOffset = currentOffsetCents(piano);
  useEffect(() => {
    if (session.mode === 'touch-up' && Math.abs(session.targetOffsetCents - latestOffset) > 0.05) {
      updateSession({ targetOffsetCents: latestOffset, tuned: [], startOffsets: [] });
      setRecentered(true);
    }
  }, [session.mode, session.targetOffsetCents, latestOffset, updateSession]);
  const targetHz = piano.a4Hz * 2 ** (session.targetOffsetCents / 1200);

  const aimFor = (key: number) => (rough && startOffsets.has(key) ? overpullCents(key, startOffsets.get(key)!) : 0);

  const onResult = useCallback(
    (r: TunerResult) => {
      const m = r.measurement;
      if (!r.active || !m) return;
      if (!history.current || history.current.key !== m.key) history.current = new ReadingHistory(m.key);
      const final =
        partial === null
          ? deviationCents(m, target.f0[m.key], target.b[m.key])
          : partialDeviationCents(m, target.f0[m.key], target.b[m.key], partial);
      setPartialMissing(final === null);
      if (final === null) return;
      const h = history.current;
      h.add({ time: r.time, cents: final, b: m.b });
      const steady = h.steady();
      const value = h.value() ?? final;
      setReading({ key: m.key, final: value, steady });

      const s = sessionRef.current;
      if (steady && rough && !s.startOffsets.some((o) => o.key === m.key)) {
        updateSession({ startOffsets: [...s.startOffsets, { key: m.key, cents: value }] });
        return;
      }
      const start = s.startOffsets.find((o) => o.key === m.key)?.cents;
      const aim = rough && start !== undefined ? overpullCents(m.key, start) : 0;
      if (steady && (!rough || start !== undefined) && Math.abs(value - aim) <= TUNED_TOLERANCE_CENTS && !s.tuned.includes(m.key)) {
        updateSession({ tuned: [...s.tuned, m.key] });
      }
    },
    [target, rough, updateSession, partial],
  );

  const tuner = useTuner(config, onResult);
  const key = locked ?? reading?.key ?? null;
  const shown = reading && key === reading.key ? reading : null;
  const aim = shown ? aimFor(shown.key) : 0;
  const display = shown ? shown.final - aim : null;
  const measuringStart = !!shown && rough && !startOffsets.has(shown.key);
  const beat = tuner.result?.active && tuner.result.measurement?.key === key ? tuner.result.beat : null;

  const choosePartial = (n: number | null) => {
    setPartial(n);
    setPartialMissing(false);
    history.current = null;
  };

  const step = (d: number) => {
    const from = key ?? 48;
    setLocked(Math.max(0, Math.min(KEY_COUNT - 1, from + d)));
  };

  const finishPass = () => {
    if (session.pass < session.passes) {
      updateSession({ pass: session.pass + 1, startOffsets: [], tuned: [] });
    } else {
      tuner.stop();
      savePiano({ ...piano, session: null });
      updateSettings({ backupDue: true });
      setFinished(true);
    }
  };

  if (finished) {
    return (
      <div className="card stack">
        <h2 style={{ margin: 0 }}>Tuning finished</h2>
        <p style={{ margin: 0 }}>
          Strings settle over the next days. Check again in a week or two, and touch up anything that has moved.
        </p>
        <div className="actions two">
          <button className="action primary" onClick={() => navigate('check')}>
            <strong>Check now</strong>
            <span>See how the whole piano reads.</span>
          </button>
          <button className="action" onClick={() => navigate('home')}>
            <strong>Done</strong>
            <span>Back to the start.</span>
          </button>
        </div>
      </div>
    );
  }

  let direction = '';
  if (partialMissing && partial !== null) direction = `Overtone ${partial} not heard. Try another, or Auto.`;
  else if (measuringStart) direction = 'Measuring where this note starts… keep it ringing.';
  else if (display !== null) {
    if (Math.abs(display) <= TUNED_TOLERANCE_CENTS) direction = 'In tune';
    else if (display < 0) direction = 'Flat: raise the pitch (tighten)';
    else direction = 'Sharp: lower the pitch (loosen)';
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="badge">
          {session.mode === 'pitch-raise' ? `Pass ${session.pass} of ${session.passes}` : 'Touch-up'}
          {rough ? ' · aim past pitch' : session.mode === 'pitch-raise' ? ' · fine pass' : ''}
        </span>
        <span className="small muted">{tuned.size} {tuned.size === 1 ? 'note' : 'notes'} done</span>
      </div>
      <div className="small muted">
        Target:{' '}
        {session.mode === 'touch-up'
          ? `the piano's current pitch (${formatA4(targetHz)}), from the check on ${new Date(latestCheck(piano)!.date).toLocaleDateString()}`
          : formatA4(targetHz)}
      </div>
      {recentered ? (
        <div className="notice" role="status">
          Re-centered on your latest check ({formatA4(targetHz)}). Notes marked done earlier were cleared.
        </div>
      ) : null}
      {session.mode === 'pitch-raise' ? <WarningBadge raiseCents={session.raiseCents} /> : null}

      <div className="tuner-layout">
        <section className="card stack">
          <div className="readout">
            <div className="stepper">
              <button className="icon" aria-label="Previous note" onClick={() => step(-1)}>
                ‹
              </button>
              <div className="note">{key === null ? '—' : keyName(key)}</div>
              <button className="icon" aria-label="Next note" onClick={() => step(1)}>
                ›
              </button>
            </div>
            <Gauge cents={measuringStart ? null : display} dim={!tuner.result?.active} />
            <div className={`cents ${measuringStart ? '' : tone(display)}`}>
              {display === null || measuringStart ? '—' : formatCents(display)}
            </div>
            <div className="direction">{tuner.listening ? direction || 'Play a note.' : 'Press Start to listen.'}</div>
            {shown && rough && !measuringStart ? (
              <div className="small muted">
                Aiming {formatCents(aim)} past the final pitch (overpull).
              </div>
            ) : null}
          </div>
          <KeyboardStrip current={key} done={tuned} onSelect={(k) => setLocked(k)} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small muted">
              {locked === null ? 'Following the note you play.' : `Holding on ${keyName(locked)}.`}
            </span>
            {locked === null ? (
              <button onClick={() => key !== null && setLocked(key)} disabled={key === null}>
                Hold this note
              </button>
            ) : (
              <button onClick={() => setLocked(null)}>Follow what I play</button>
            )}
          </div>
          <label className="field">
            Overtone
            <select value={partial ?? ''} onChange={(e) => choosePartial(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Auto (all overtones heard)</option>
              {Array.from({ length: maxPartials(0) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n} disabled={key !== null && n > maxPartials(key)}>
                  {n === 1 ? '1st (fundamental)' : `${n}${n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`}
                </option>
              ))}
            </select>
            <span className="hint">
              Auto suits most notes. Pick one overtone if the needle wanders, e.g. a low overtone on a bass note with a weak or
              false fundamental.
            </span>
          </label>
          {settings.showSpectrum ? (
            <Spectrum bands={tuner.result?.spectrum ?? null} measurement={tuner.result?.measurement ?? null} selected={partial} />
          ) : null}
        </section>

        <section className="stack">
          {tuner.error ? <div className="notice danger">{tuner.error}</div> : null}
          {tuner.listening ? (
            <button className="block" onClick={tuner.stop}>
              Stop listening
            </button>
          ) : (
            <button className="primary block" disabled={tuner.starting} onClick={tuner.start}>
              {tuner.starting ? 'Starting…' : 'Start'}
            </button>
          )}

          <div className="card stack">
            <label className="toggle">
              <span>
                <strong>Unison helper</strong>
                <br />
                <span className="small muted">Match the 2–3 strings of one note.</span>
              </span>
              <input type="checkbox" checked={unison} onChange={(e) => setUnison(e.target.checked)} />
            </label>
            {unison ? <UnisonPanel beat={beat} /> : null}
          </div>

          <button className="block" onClick={finishPass}>
            {session.pass < session.passes ? `Finish pass ${session.pass}` : 'Finish tuning'}
          </button>

          <details className="info card small">
            <summary>Tips</summary>
            <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
              <li>Mute the other strings of the note with a rubber mute so only one string sounds.</li>
              <li>Turn the lever in tiny movements, and play the note again after each one.</li>
              <li>Approach the target from below (tightening) so the pin stays set. If you overshoot, go a little under and come back up.</li>
              <li>A note turns green on the keyboard once it holds within ±{TUNED_TOLERANCE_CENTS} cent of its target.</li>
            </ul>
          </details>
        </section>
      </div>
    </div>
  );
}

function UnisonPanel({ beat }: { beat: TunerResult['beat'] }) {
  let status: { text: string; cls: string };
  if (!beat) status = { text: 'Play the note and let it ring for 2 seconds…', cls: 'muted' };
  else if (beat.beatHz !== null) status = { text: `Beating about ${beat.beatHz.toFixed(1)} times per second`, cls: 'tone-warn' };
  else if (beat.depthDb < 1) status = { text: 'Steady: the strings match', cls: 'tone-ok' };
  else status = { text: 'Slight wobble: keep adjusting slowly', cls: 'tone-warn' };
  return (
    <div className="stack small">
      <div className={status.cls} style={{ fontSize: '1.05rem', fontWeight: 600 }}>
        {status.text}
      </div>
      <ol style={{ margin: 0, paddingLeft: '1.2em' }}>
        <li>Mute all but one string and tune it to the needle.</li>
        <li>Unmute the next string and play the note.</li>
        <li>Turn that string's pin slowly until the beating slows and stops.</li>
      </ol>
      <p className="muted" style={{ margin: 0 }}>
        Aim for no beating. Strings within about {THRESHOLDS.unisonTargetCents} cent of each other sound clean.
      </p>
    </div>
  );
}
