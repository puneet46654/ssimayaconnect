'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type StoredDraft<T> = { version: 1; values: T; thumbnail: File | null };
let database: Promise<IDBDatabase> | undefined;
function openDrafts() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ssi-form-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('events');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}
async function stored<T>(key: string, action: 'read' | 'write' | 'delete', value?: StoredDraft<T>) {
  const db = await openDrafts();
  return new Promise<StoredDraft<T> | undefined>((resolve, reject) => {
    const transaction = db.transaction('events', action === 'read' ? 'readonly' : 'readwrite');
    const store = transaction.objectStore('events');
    const request = action === 'read' ? store.get(key) : action === 'write' ? store.put(value, key) : store.delete(key);
    transaction.oncomplete = () => resolve(action === 'read' ? request.result : undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
function sessionKey(key: string) {
  let id = sessionStorage.getItem('ssi-draft-session');
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('ssi-draft-session', id); }
  return `${id}:${key}`;
}

/** Explicit controlled state, including the selected image; separate keys for new and each edit. */
export function useEventDraft<T extends object>(key: string, values: T, thumbnail: File | null,
  restore: (values: T, thumbnail: File | null) => void, enabled = true) {
  const [readyKey, setReadyKey] = useState('');
  const complete = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const restoreRef = useRef(restore);
  useEffect(() => { restoreRef.current = restore; }, [restore]);
  const serialized = JSON.stringify(values);

  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    complete.current = false;
    async function load() {
      let draft: StoredDraft<T> | undefined;
      try { draft = await stored<T>(sessionKey(key), 'read'); } catch { /* Text fallback below. */ }
      if (!draft) {
        try { draft = JSON.parse(sessionStorage.getItem(key) || 'null') || undefined; } catch { /* Start fresh. */ }
      }
      if (cancelled) return;
      if (draft?.version === 1 && draft.values && typeof draft.values === 'object') {
        restoreRef.current(draft.values, draft.thumbnail instanceof File ? draft.thumbnail : null);
      }
      setReadyKey(key);
    }
    void load();
    return () => { cancelled = true; };
  }, [enabled, key]);

  useEffect(() => {
    if (!enabled || readyKey !== key || complete.current) return;
    const draft: StoredDraft<T> = { version: 1, values: JSON.parse(serialized), thumbnail };
    // Text remains restorable if IndexedDB is unavailable or blocked by browser settings.
    try { sessionStorage.setItem(key, JSON.stringify({ ...draft, thumbnail: null })); } catch { /* Optional persistence. */ }
    queue.current = queue.current.then(() => stored(sessionKey(key), 'write', draft)).catch(() => {});
  }, [enabled, readyKey, key, serialized, thumbnail]);

  const clear = useCallback(async () => {
    complete.current = true;
    await queue.current;
    try { await stored(sessionKey(key), 'delete'); } catch { /* Clear text even if the database is unavailable. */ }
    try { sessionStorage.removeItem(key); } catch { /* Optional persistence. */ }
  }, [key]);
  return { ready: readyKey === key, clear };
}
