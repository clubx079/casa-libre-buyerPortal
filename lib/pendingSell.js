// Survives the Google-OAuth full-page redirect: stashes the guest's collected
// listing (fields + photo Blobs) in IndexedDB before login, so it can be
// published on return. IndexedDB is used (not sessionStorage) because it stores
// File/Blob objects natively and has room for photos. All ops fail-soft.
const DB = 'casa_libre_sell';
const STORE = 'pending';
const KEY = 'listing';

function idb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePendingSell(payload) {
  try {
    const db = await idb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(payload, KEY);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch { return false; }
}

export async function loadPendingSell() {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const tx = db.transaction(STORE, 'readonly');
      const g = tx.objectStore(STORE).get(KEY);
      g.onsuccess = () => res(g.result || null);
      g.onerror = () => res(null);
    });
  } catch { return null; }
}

export async function clearPendingSell() {
  try {
    const db = await idb();
    await new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = res;
      tx.onerror = res;
    });
  } catch { /* ignore */ }
}

// The open wizard's photos while it's closed ({ owner, files }), so reopening it puts
// them back — kept apart from the Google-redirect stash above. Fail-soft.
const PHOTOS_KEY = 'progress_photos';
export async function saveProgressPhotos(payload) {
  try {
    const db = await idb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(payload, PHOTOS_KEY);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch { /* ignore */ }
}
export async function loadProgressPhotos() {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const tx = db.transaction(STORE, 'readonly');
      const g = tx.objectStore(STORE).get(PHOTOS_KEY);
      g.onsuccess = () => res(g.result || null);
      g.onerror = () => res(null);
    });
  } catch { return null; }
}
export async function clearProgressPhotos() {
  try {
    const db = await idb();
    await new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(PHOTOS_KEY);
      tx.oncomplete = res;
      tx.onerror = res;
    });
  } catch { /* ignore */ }
}
