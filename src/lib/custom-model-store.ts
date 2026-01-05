const DB_NAME = "cosmic-atlas";
const STORE_NAME = "custom-models";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable on server"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
};

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await getDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = handler(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
};

export const saveModelBlob = (id: string, blob: Blob) =>
  runTransaction("readwrite", (store) => store.put(blob, id));

export const loadModelBlob = (id: string) =>
  runTransaction("readonly", (store) => store.get(id)).then((result) =>
    result instanceof Blob ? result : null,
  );

export const deleteModelBlob = (id: string) =>
  runTransaction("readwrite", (store) => store.delete(id));
