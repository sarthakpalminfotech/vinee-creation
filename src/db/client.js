// DB adapter: Turso (libSQL over HTTP) when env is configured, else local SQLite (sql.js) persisted in IndexedDB.
import { SCHEMA, TABLES } from './schema'

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});
const TURSO_URL = env.VITE_TURSO_DATABASE_URL
const TURSO_TOKEN = env.VITE_TURSO_AUTH_TOKEN
export const mode = TURSO_URL ? 'turso' : 'local'

const clean = (args = []) => args.map((a) => (a === undefined ? null : typeof a === 'boolean' ? (a ? 1 : 0) : a))

// ---------- IndexedDB helpers (local mode persistence) ----------
const IDB = 'vinee-creation', STORE = 'kv', KEY = 'sqlite'
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function idbGet() {
  const db = await idb()
  return new Promise((res) => {
    const q = db.transaction(STORE).objectStore(STORE).get(KEY)
    q.onsuccess = () => res(q.result || null)
    q.onerror = () => res(null)
  })
}
async function idbSet(val) {
  const db = await idb()
  return new Promise((res) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(val, KEY)
    tx.oncomplete = res
  })
}

async function makeLocal() {
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' })
  const saved = await idbGet()
  const db = saved ? new SQL.Database(saved) : new SQL.Database()
  let timer
  const persist = () => { clearTimeout(timer); timer = setTimeout(() => idbSet(db.export()), 250) }
  return {
    async all(sql, args) {
      const st = db.prepare(sql)
      st.bind(clean(args))
      const rows = []
      while (st.step()) rows.push(st.getAsObject())
      st.free()
      return rows
    },
    async run(sql, args) {
      db.run(sql, clean(args))
      const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
      persist()
      return { lastId: Number(lastId), changes: db.getRowsModified() }
    },
  }
}

async function makeTurso() {
  const { createClient } = await import('@libsql/client/web')
  const c = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })
  return {
    async all(sql, args) {
      const r = await c.execute({ sql, args: clean(args) })
      return r.rows.map((row) => Object.fromEntries(r.columns.map((col, i) => [col, row[i]])))
    },
    async run(sql, args) {
      const r = await c.execute({ sql, args: clean(args) })
      return { lastId: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected }
    },
  }
}

let ready
export function db() {
  if (!ready) {
    ready = (async () => {
      const impl = mode === 'turso' ? await makeTurso() : await makeLocal()
      for (const s of SCHEMA) await impl.run(s)
      return impl
    })()
  }
  return ready
}

export const all = async (sql, args) => (await db()).all(sql, args)
export const one = async (sql, args) => (await all(sql, args))[0] || null
export const run = async (sql, args) => (await db()).run(sql, args)

export async function dropAll() {
  for (const t of TABLES) await run(`DELETE FROM ${t}`)
  await run(`DELETE FROM sqlite_sequence`).catch(() => {})
}
