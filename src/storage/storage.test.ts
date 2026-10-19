import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { deletePiano, ensureAPiano, listPianos, putPianos, savePiano } from './db';
import { newPiano } from './schema';
import { makeBackup, parseBackup, pianoFileName, planImport, resolveImport } from './transfer';

describe('transfer', () => {
  const a = newPiano('Living room upright');
  const b = newPiano('Studio grand');

  it('round-trips a full backup', () => {
    const result = parseBackup(JSON.stringify(makeBackup([a, b])));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.pianos.map((p) => p.name)).toEqual([a.name, b.name]);
  });

  it('reads a single-piano export', () => {
    const result = parseBackup(JSON.stringify(makeBackup([a])));
    expect(result.ok && result.backup.pianos.length).toBe(1);
  });

  it('rejects other files with a clear message', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'This file is not valid JSON.' });
    expect(parseBackup('{"hello":1}')).toMatchObject({ ok: false, error: expect.stringContaining('not exported') });
    const newer = { ...makeBackup([a]), schemaVersion: 99 };
    expect(parseBackup(JSON.stringify(newer))).toMatchObject({ ok: false, error: expect.stringContaining('newer') });
    const broken = makeBackup([{ ...a, a4Hz: 1000 }]);
    expect(parseBackup(JSON.stringify(broken))).toMatchObject({ ok: false, error: expect.stringContaining('a4Hz') });
  });

  it('resolves conflicts per piano', () => {
    const backup = makeBackup([a, b]);
    const items = planImport(backup, new Set([a.id]));
    expect(items.map((i) => [i.exists, i.resolution])).toEqual([
      [true, 'skip'],
      [false, 'replace'],
    ]);
    items[0].resolution = 'keep-both';
    const out = resolveImport(items, new Set([a.name]));
    expect(out).toHaveLength(2);
    expect(out[0].id).not.toBe(a.id);
    expect(out[0].name).toBe('Living room upright (imported)');
    expect(out[1]).toEqual(b);
  });

  it('migrates version 1 files to octave-type handles', () => {
    const { octaveTypes: _, ...rest } = a;
    const v1 = { ...makeBackup([]), schemaVersion: 1, pianos: [{ ...rest, stretch: 'wide' }] };
    const result = parseBackup(JSON.stringify(v1));
    expect(result.ok && result.backup.pianos[0].octaveTypes).toEqual([5, 4, 3, 1.5, 1.5]);
  });

  it('names export files', () => {
    expect(pianoFileName(a)).toBe('living-room-upright.piano.json');
  });
});

describe('db', () => {
  it('saves, lists, imports and deletes', async () => {
    const a = await savePiano(newPiano('One'));
    await putPianos([newPiano('Two'), newPiano('Three')]);
    expect((await listPianos()).map((p) => p.name).sort()).toEqual(['One', 'Three', 'Two']);
    await deletePiano(a.id);
    expect((await listPianos()).map((p) => p.name).sort()).toEqual(['Three', 'Two']);
  });
});

describe('ensureAPiano', () => {
  it('adds only one piano when called concurrently', async () => {
    for (const p of await listPianos()) await deletePiano(p.id);
    await Promise.all([ensureAPiano(() => newPiano('A')), ensureAPiano(() => newPiano('B'))]);
    expect(await listPianos()).toHaveLength(1);
  });
});
