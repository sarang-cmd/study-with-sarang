/** Video files for the study room live in IndexedDB, so they survive a restart without any path or upload. The page makes an object URL while one plays. */
const DB = 'study-with-sarang-room'; const STORE = 'files';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('This browser cannot store files.')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error ?? new Error('Could not open the file store.'));
  });
}
async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode); const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); }; tx.onerror = () => { db.close(); reject(tx.error ?? new Error('The file store failed.')); }; tx.onabort = () => { db.close(); reject(tx.error ?? new Error('The file store ran out of room.')); };
  });
}
export const putRoomFile = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id)).then(() => undefined);
export const getRoomFile = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>);
export const deleteRoomFile = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined);
export async function storageEstimate(): Promise<{ used: number; quota: number } | null> {
  try { const e = await navigator.storage?.estimate?.(); return e ? { used: e.usage ?? 0, quota: e.quota ?? 0 } : null; } catch { return null; }
}
