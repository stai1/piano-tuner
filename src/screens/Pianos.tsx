import { useRef, useState } from 'react';
import { useApp } from '../app/context';
import type { Piano } from '../storage/schema';
import {
  backupFileName,
  downloadJson,
  makeBackup,
  parseBackup,
  pianoFileName,
  planImport,
  resolveImport,
  type ImportItem,
  type Resolution,
} from '../storage/transfer';
import { latestCheck } from '../tuning/model';
import { VERDICT_LABEL } from '../tuning/verdict';

export function PianosScreen() {
  const { store, piano: current, selectPiano, updateSettings } = useApp();
  const [adding, setAdding] = useState('');
  const [importPlan, setImportPlan] = useState<ImportItem[] | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportAll = () => {
    downloadJson(makeBackup(store.pianos), backupFileName());
    updateSettings({ backupDue: false });
  };

  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    const p = await store.create(name);
    selectPiano(p.id);
    setAdding('');
    updateSettings({ backupDue: true });
  };

  const readFile = async (file: File) => {
    setMessage(null);
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setMessage({ tone: 'danger', text: result.error });
      return;
    }
    setImportPlan(planImport(result.backup, new Set(store.pianos.map((p) => p.id))));
  };

  const runImport = async (items: ImportItem[]) => {
    const pianos = resolveImport(items, new Set(store.pianos.map((p) => p.name)));
    try {
      if (pianos.length > 0) await store.importMany(pianos);
      setMessage({
        tone: 'ok',
        text: pianos.length === 0 ? 'Nothing was imported.' : `Imported ${pianos.length} ${pianos.length === 1 ? 'piano' : 'pianos'}.`,
      });
    } catch {
      setMessage({ tone: 'danger', text: 'The import failed. Your existing pianos were not changed.' });
    }
    setImportPlan(null);
  };

  return (
    <div className="stack">
      {message ? <div className={`notice ${message.tone}`}>{message.text}</div> : null}

      {importPlan ? (
        <ImportPreview items={importPlan} onCancel={() => setImportPlan(null)} onImport={runImport} />
      ) : (
        <>
          <ul className="list">
            {store.pianos.map((p) => (
              <PianoCard key={p.id} piano={p} isCurrent={p.id === current.id} />
            ))}
          </ul>

          <section className="card stack">
            <h2 style={{ margin: 0 }}>Add a piano</h2>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input
                value={adding}
                placeholder="e.g. Studio upright"
                maxLength={100}
                onChange={(e) => setAdding(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                aria-label="New piano name"
              />
              <button onClick={add} disabled={!adding.trim()}>
                Add
              </button>
            </div>
          </section>

          <section className="card stack">
            <h2 style={{ margin: 0 }}>Backup</h2>
            <p className="small muted" style={{ margin: 0 }}>
              Pianos are saved only in this browser. Export a file to keep a backup or to move pianos to another device.
            </p>
            <div className="row">
              <button className="primary" onClick={exportAll}>
                Export all pianos
              </button>
              <button onClick={() => fileInput.current?.click()}>Import from file</button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) readFile(f);
                }}
              />
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              Import reads both single-piano files and full backups.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function PianoCard({ piano, isCurrent }: { piano: Piano; isCurrent: boolean }) {
  const { store, selectPiano, savePiano } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(piano.name);
  const [notes, setNotes] = useState(piano.notes);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const check = latestCheck(piano);

  const save = async () => {
    await savePiano({ ...piano, name: name.trim() || piano.name, notes });
    setEditing(false);
  };

  return (
    <li className="card stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{piano.name}</strong>
          {isCurrent ? <span className="badge" style={{ marginLeft: 8 }}>Selected</span> : null}
          <div className="small muted">
            {check ? `${VERDICT_LABEL[check.verdict]} · checked ${new Date(check.date).toLocaleDateString()}` : 'Not checked yet'}
          </div>
        </div>
        {!isCurrent ? <button onClick={() => selectPiano(piano.id)}>Select</button> : null}
      </div>

      {editing ? (
        <div className="stack">
          <label className="field">
            Name
            <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            Notes
            <textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Make, model, location…" />
          </label>
          <div className="row">
            <button className="primary" onClick={save}>
              Save
            </button>
            <button className="ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {piano.notes ? <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{piano.notes}</p> : null}
          <div className="row">
            <button onClick={() => setEditing(true)}>Edit</button>
            <button onClick={() => downloadJson(makeBackup([piano]), pianoFileName(piano))}>Export</button>
            {confirmDelete ? (
              <>
                <button className="danger" onClick={() => store.remove(piano.id)}>
                  Delete {piano.name}
                </button>
                <button className="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </>
            ) : (
              <button className="danger" onClick={() => setConfirmDelete(true)} disabled={store.pianos.length === 1}>
                Delete
              </button>
            )}
          </div>
          {confirmDelete ? (
            <p className="small tone-danger" style={{ margin: 0 }}>
              This removes the piano and all its checks from this browser. Export it first if you may want it back.
            </p>
          ) : null}
        </>
      )}
    </li>
  );
}

const RESOLUTION_LABEL: Record<Resolution, string> = {
  replace: 'Replace the one here',
  'keep-both': 'Keep both',
  skip: 'Skip',
};

function ImportPreview({
  items: initial,
  onCancel,
  onImport,
}: {
  items: ImportItem[];
  onCancel: () => void;
  onImport: (items: ImportItem[]) => void;
}) {
  const [items, setItems] = useState(initial);
  const setResolution = (i: number, resolution: Resolution) =>
    setItems((list) => list.map((item, j) => (j === i ? { ...item, resolution } : item)));
  const count = items.filter((i) => i.resolution !== 'skip').length;

  return (
    <section className="card stack">
      <h2 style={{ margin: 0 }}>Import {items.length === 1 ? '1 piano' : `${items.length} pianos`}</h2>
      <ul className="list">
        {items.map((item, i) => (
          <li key={item.piano.id} className="stack" style={{ gap: 6 }}>
            <div>
              <strong>{item.piano.name}</strong>
              <div className="small muted">
                {item.piano.checks.length} {item.piano.checks.length === 1 ? 'check' : 'checks'}
                {item.exists ? ' · already on this device' : ' · new'}
              </div>
            </div>
            {item.exists ? (
              <select value={item.resolution} onChange={(e) => setResolution(i, e.target.value as Resolution)}>
                {(['replace', 'keep-both', 'skip'] as Resolution[]).map((r) => (
                  <option key={r} value={r}>
                    {RESOLUTION_LABEL[r]}
                  </option>
                ))}
              </select>
            ) : (
              <label className="toggle small">
                <span>Import this piano</span>
                <input
                  type="checkbox"
                  checked={item.resolution !== 'skip'}
                  onChange={(e) => setResolution(i, e.target.checked ? 'replace' : 'skip')}
                />
              </label>
            )}
          </li>
        ))}
      </ul>
      <div className="row">
        <button className="primary" onClick={() => onImport(items)} disabled={count === 0}>
          Import {count}
        </button>
        <button className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
