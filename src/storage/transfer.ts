import { FILE_FORMAT, SCHEMA_VERSION, backupSchema, type Backup, type Piano } from './schema';

export function makeBackup(pianos: Piano[], now = new Date()): Backup {
  return { format: FILE_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), pianos };
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'piano'
  );
}

export function pianoFileName(piano: Piano): string {
  return `${slug(piano.name)}.piano.json`;
}

export function backupFileName(now = new Date()): string {
  return `pianos-backup-${now.toISOString().slice(0, 10)}.json`;
}

export function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

// Reads either export type: a single piano is a backup with one entry.
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== FILE_FORMAT) {
    return { ok: false, error: 'This file was not exported from Piano Tuner.' };
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version === 'number' && version > SCHEMA_VERSION) {
    return { ok: false, error: 'This file was made by a newer version of Piano Tuner. Reload the app to update it.' };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `This file is damaged or incomplete (${issue.path.join('.') || 'file'}: ${issue.message}).` };
  }
  const ids = new Set<string>();
  for (const p of parsed.data.pianos) {
    if (ids.has(p.id)) return { ok: false, error: 'This file lists the same piano twice.' };
    ids.add(p.id);
  }
  return { ok: true, backup: parsed.data };
}

export type Resolution = 'replace' | 'keep-both' | 'skip';

export interface ImportItem {
  piano: Piano;
  exists: boolean;
  resolution: Resolution;
}

export function planImport(backup: Backup, existingIds: ReadonlySet<string>): ImportItem[] {
  return backup.pianos.map((piano) => {
    const exists = existingIds.has(piano.id);
    return { piano, exists, resolution: exists ? 'skip' : 'replace' };
  });
}

// The pianos to write for a resolved import plan.
export function resolveImport(items: ImportItem[], existingNames: ReadonlySet<string>): Piano[] {
  const names = new Set(existingNames);
  const out: Piano[] = [];
  for (const item of items) {
    if (item.resolution === 'skip') continue;
    if (item.resolution === 'replace' || !item.exists) {
      out.push(item.piano);
      names.add(item.piano.name);
      continue;
    }
    let name = `${item.piano.name} (imported)`;
    for (let i = 2; names.has(name); i++) name = `${item.piano.name} (imported ${i})`;
    names.add(name);
    out.push({ ...item.piano, id: crypto.randomUUID(), name });
  }
  return out;
}
