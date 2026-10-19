// Original CV binaries. Prototype: IndexedDB. Production: data/cv_files/<sha256>.<ext> next to ats.sqlite.
const DB = 'sothema-hr-files'
const STORE = 'files'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const files = {
  put: (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id)).then(() => undefined),
  get: (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id)).catch(() => undefined),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)).then(() => undefined).catch(() => undefined),
  clear: () => tx('readwrite', (s) => s.clear()).then(() => undefined).catch(() => undefined),
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
