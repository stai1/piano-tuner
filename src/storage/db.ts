import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { migratePiano, type Piano } from './schema';

interface TunerDB extends DBSchema {
  pianos: { key: string; value: Piano };
}

let dbPromise: Promise<IDBPDatabase<TunerDB>> | null = null;

function db(): Promise<IDBPDatabase<TunerDB>> {
  dbPromise ??= openDB<TunerDB>('piano-tuner', 1, {
    upgrade(database) {
      database.createObjectStore('pianos', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

export async function listPianos(): Promise<Piano[]> {
  const all = ((await (await db()).getAll('pianos')) as unknown[]).map((p) => migratePiano(p) as Piano);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
}

export async function savePiano(piano: Piano): Promise<Piano> {
  const saved = { ...piano, updatedAt: new Date().toISOString() };
  await (await db()).put('pianos', saved);
  requestPersistence();
  return saved;
}

export async function deletePiano(id: string): Promise<void> {
  await (await db()).delete('pianos', id);
}

// Adds the piano only if none exist yet. Runs in one transaction so two
// concurrent first loads can't both add one.
export async function ensureAPiano(make: () => Piano): Promise<void> {
  const tx = (await db()).transaction('pianos', 'readwrite');
  if ((await tx.store.count()) === 0) await tx.store.put(make());
  await tx.done;
}

// Writes all pianos in one transaction: either all land or none do.
export async function putPianos(pianos: Piano[]): Promise<void> {
  const tx = (await db()).transaction('pianos', 'readwrite');
  await Promise.all([...pianos.map((p) => tx.store.put(p)), tx.done]);
  requestPersistence();
}

let persistenceRequested = false;

// Asks the browser not to evict our data under storage pressure.
function requestPersistence(): void {
  if (persistenceRequested || typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  persistenceRequested = true;
  navigator.storage.persist().catch(() => {});
}

// For tests.
export function resetDbConnection(): void {
  dbPromise = null;
}
