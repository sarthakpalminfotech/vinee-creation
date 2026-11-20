// Voice notes that could not be uploaded stay on THIS device only (IndexedDB, keyed by the damage id).
// The database only keeps voice_local = 1; audio is never stored inside the main database.
const DB = 'vinee-voice', STORE = 'notes'

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
export async function saveVoice(damageId, blob) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, String(damageId))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
/** The recording as a Blob, or null when this device does not have it. */
export async function getVoice(damageId) {
  try {
    const db = await open()
    return await new Promise((resolve) => {
      const q = db.transaction(STORE).objectStore(STORE).get(String(damageId))
      q.onsuccess = () => resolve(q.result || null)
      q.onerror = () => resolve(null)
    })
  } catch { return null }
}
