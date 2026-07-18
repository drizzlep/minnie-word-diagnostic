const DB_NAME = "minnie-word-diagnostic";
const DB_VERSION = 1;
const STORE = "state";
const STATE_KEY = "active-diagnostic";

export async function loadState() {
  if (!("indexedDB" in globalThis)) return fallbackLoad();
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(STATE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch { return fallbackLoad(); }
}

export async function saveState(state) {
  if (!("indexedDB" in globalThis)) return fallbackSave(state);
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(state, STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch { return fallbackSave(state); }
}

export async function clearState() {
  if (!("indexedDB" in globalThis)) {
    localStorage.removeItem(STATE_KEY);
    return;
  }
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch { localStorage.removeItem(STATE_KEY); }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function fallbackLoad() {
  try {
    const value = localStorage.getItem(STATE_KEY);
    return value ? JSON.parse(value) : null;
  } catch { return null; }
}

function fallbackSave(state) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* Session continues without persistence. */ }
}
