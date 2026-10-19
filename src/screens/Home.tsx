import { useApp } from '../app/context';
import { CheckChart } from '../components/CheckChart';
import { keyName } from '../dsp/notes';
import { makeBackup, backupFileName, downloadJson } from '../storage/transfer';
import { latestCheck } from '../tuning/model';
import { VERDICT_LABEL, VERDICT_TONE, verdictText } from '../tuning/verdict';

export function Home() {
  const { piano, store, selectPiano, settings, updateSettings, navigate } = useApp();
  const check = latestCheck(piano);
  const verdict = check?.verdict;
  const wantsRaise = verdict === 'pitch-raise' || verdict === 'large-pitch-raise';

  const backupNow = () => {
    downloadJson(makeBackup(store.pianos), backupFileName());
    updateSettings({ backupDue: false });
  };

  return (
    <div className="stack">
      {store.pianos.length > 1 ? (
        <label className="field">
          Piano
          <select value={piano.id} onChange={(e) => selectPiano(e.target.value)}>
            {store.pianos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {settings.backupDue ? (
        <div className="notice warn row" style={{ justifyContent: 'space-between' }}>
          <span>Your pianos are only saved in this browser. Save a backup file.</span>
          <span className="row">
            <button onClick={backupNow}>Back up</button>
            <button className="ghost" onClick={() => updateSettings({ backupDue: false })}>
              Later
            </button>
          </span>
        </div>
      ) : null}

      <section className="card stack">
        {check ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Last check</h2>
              <span className={`badge ${VERDICT_TONE[check.verdict]}`}>{VERDICT_LABEL[check.verdict]}</span>
            </div>
            <p style={{ margin: 0 }}>{verdictText(check, piano.a4Hz)}</p>
            <CheckChart check={check} />
            <p className="small muted" style={{ margin: 0 }}>
              Checked {new Date(check.date).toLocaleDateString()}
              {check.notes.some((n) => n.cents === null)
                ? ` · No reading for ${check.notes
                    .filter((n) => n.cents === null)
                    .map((n) => keyName(n.key))
                    .join(', ')}`
                : ''}
            </p>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0 }}>Start with a check</h2>
            <p style={{ margin: 0 }}>
              Play 9 notes across the keyboard. The app measures how far your piano is from pitch and learns its strings, so
              tuning targets fit this piano.
            </p>
          </>
        )}
      </section>

      {piano.session ? (
        <div className="notice row" style={{ justifyContent: 'space-between' }}>
          <span>
            {piano.session.mode === 'pitch-raise' ? 'Pitch raise' : 'Touch-up'} in progress · pass {piano.session.pass} of{' '}
            {piano.session.passes} · {piano.session.tuned.length} notes done
          </span>
          <button className="primary" onClick={() => navigate(piano.session!.mode === 'pitch-raise' ? 'raise' : 'tune')}>
            Continue
          </button>
        </div>
      ) : null}

      <div className="actions two">
        <button className={`action${!check ? ' primary' : ''}`} onClick={() => navigate('check')}>
          <strong>Check my piano</strong>
          <span>See how far it is from pitch. No tools needed.</span>
        </button>
        <button className={`action${check && !wantsRaise ? ' primary' : ''}`} disabled={!check} onClick={() => navigate('tune')}>
          <strong>Touch-up tuning</strong>
          <span>Fix notes and unisons at the current pitch.</span>
        </button>
        <button className={`action${wantsRaise ? ' primary' : ''}`} disabled={!check} onClick={() => navigate('raise')}>
          <strong>Pitch raise</strong>
          <span>Bring the whole piano to A{piano.a4Hz}.</span>
        </button>
        <button className="action" onClick={() => navigate('learn')}>
          <strong>Learn the basics</strong>
          <span>Tools, technique, and what the numbers mean.</span>
        </button>
      </div>

      <button className="block" onClick={() => navigate('pianos')}>
        Pianos &amp; backup
      </button>
    </div>
  );
}
