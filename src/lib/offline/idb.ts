/**
 * Tiny promise-wrapped IndexedDB helper for the offline layer. Zero deps so it
 * works the same in the browser and inside the Capacitor web view. We keep this
 * deliberately small (a single object store of records keyed by id) because the
 * only consumer is the mutation outbox; document-body offline uses y-indexeddb,
 * not this.
 *
 * Everything is SSR-safe: each call no-ops (resolves empty) when there is no
 * `indexedDB` (server render), so importing this never crashes a server bundle.
 */

const DB_NAME = "wc-offline";
const DB_VERSION = 1;
/** The mutation outbox: one record per queued, not-yet-confirmed mutation. */
export const OUTBOX_STORE = "outbox";

function hasIdb(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        // keyPath "id" so put() upserts and delete(id) removes a single entry.
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
      }),
  );
}

/** Insert or replace a record (keyed by its `id`). No-op without IndexedDB. */
export async function idbPut<T extends { id: string }>(store: string, value: T): Promise<void> {
  if (!hasIdb()) return;
  await tx(store, "readwrite", (s) => s.put(value));
}

/** Read every record in a store. Returns [] without IndexedDB. */
export async function idbGetAll<T>(store: string): Promise<T[]> {
  if (!hasIdb()) return [];
  return tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}

/** Remove one record by id. No-op without IndexedDB. */
export async function idbDelete(store: string, id: string): Promise<void> {
  if (!hasIdb()) return;
  await tx(store, "readwrite", (s) => s.delete(id));
}
