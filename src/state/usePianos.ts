import { useCallback, useEffect, useState } from 'react';
import { deletePiano, listPianos, putPianos, savePiano } from '../storage/db';
import { newPiano, type Piano } from '../storage/schema';

export interface PianoStore {
  pianos: Piano[];
  loaded: boolean;
  error: string | null;
  save: (piano: Piano) => Promise<Piano>;
  create: (name: string) => Promise<Piano>;
  remove: (id: string) => Promise<void>;
  importMany: (pianos: Piano[]) => Promise<void>;
}

export function usePianos(): PianoStore {
  const [pianos, setPianos] = useState<Piano[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      let list = await listPianos();
      if (list.length === 0) {
        await savePiano(newPiano('My piano'));
        list = await listPianos();
      }
      setPianos(list);
    } catch {
      setError('Saved pianos could not be loaded. This browser may be blocking storage for this site.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (piano: Piano) => {
    const saved = await savePiano(piano);
    setPianos((list) => {
      const i = list.findIndex((p) => p.id === saved.id);
      if (i < 0) return [...list, saved];
      const next = list.slice();
      next[i] = saved;
      return next;
    });
    return saved;
  }, []);

  const create = useCallback((name: string) => save(newPiano(name)), [save]);

  const remove = useCallback(
    async (id: string) => {
      await deletePiano(id);
      await refresh();
    },
    [refresh],
  );

  const importMany = useCallback(
    async (list: Piano[]) => {
      await putPianos(list);
      await refresh();
    },
    [refresh],
  );

  return { pianos, loaded, error, save, create, remove, importMany };
}
