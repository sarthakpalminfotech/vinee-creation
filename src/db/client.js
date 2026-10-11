// DB adapter: Turso (libSQL over HTTP) when env is configured, else local SQLite (sql.js) persisted in IndexedDB.
import { SCHEMA, MIGRATIONS, TABLES } from './schema'

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
  // In a browser the wasm is served from /public; under Node (tests) sql.js finds its own wasm.
  const inBrowser = typeof indexedDB !== 'undefined'
  const SQL = await initSqlJs(inBrowser ? { locateFile: () => '/sql-wasm.wasm' } : {})
  const saved = inBrowser ? await idbGet() : null
  const db = saved ? new SQL.Database(saved) : new SQL.Database()
  let timer
  const persist = () => { if (!inBrowser) return; clearTimeout(timer); timer = setTimeout(() => idbSet(db.export()), 250) }
  const exec = {
    all(sql, args) {
      const st = db.prepare(sql)
      st.bind(clean(args))
      const rows = []
      while (st.step()) rows.push(st.getAsObject())
      st.free()
      return rows
    },
    run(sql, args) {
      db.run(sql, clean(args))
      const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
      return { lastId: Number(lastId), changes: db.getRowsModified() }
    },
  }
  // One connection: serialise everything so a transaction never interleaves with other statements.
  let chain = Promise.resolve()
  const serial = (fn) => { const p = chain.then(fn); chain = p.catch(() => {}); return p }
  return {
    all: (sql, args) => serial(() => exec.all(sql, args)),
    run: (sql, args) => serial(() => { const r = exec.run(sql, args); persist(); return r }),
    transaction: (fn) => serial(async () => {
      db.run('BEGIN')
      try {
        const out = await fn({ all: async (sql, args) => exec.all(sql, args), run: async (sql, args) => exec.run(sql, args) })
        db.run('COMMIT')
        persist()
        return out
      } catch (e) {
        try { db.run('ROLLBACK') } catch { /* nothing to roll back */ }
        throw e
      }
    }),
    exportBytes: () => db.export(),
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
    async transaction(fn) {
      const t = await c.transaction('write')
      try {
        const out = await fn({
          all: async (sql, args) => { const r = await t.execute({ sql, args: clean(args) }); return r.rows.map((row) => Object.fromEntries(r.columns.map((col, i) => [col, row[i]]))) },
          run: async (sql, args) => { const r = await t.execute({ sql, args: clean(args) }); return { lastId: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected } },
        })
        await t.commit()
        return out
      } catch (e) {
        try { await t.rollback() } catch { /* already closed */ }
        throw e
      } finally {
        t.close()
      }
    },
  }
}

let ready
export function db() {
  if (!ready) {
    ready = (async () => {
      const impl = mode === 'turso' ? await makeTurso() : await makeLocal()
      for (const s of SCHEMA) await impl.run(s)
      // Optional additive migrations (indexes etc.): never fatal, e.g. a unique index is skipped if old data already has duplicates.
      for (const m of MIGRATIONS) await impl.run(m).catch((e) => console.warn('Migration skipped:', m, e?.message))
      return impl
    })()
  }
  return ready
}

export const all = async (sql, args) => (await db()).all(sql, args)
export const one = async (sql, args) => (await all(sql, args))[0] || null
export const run = async (sql, args) => (await db()).run(sql, args)
/** Run fn({all, one, run}) as one atomic transaction (all-or-nothing). Use ONLY the passed handle inside fn. */
export async function tx(fn) {
  const impl = await db()
  return impl.transaction((t) => fn({ all: t.all, one: async (sql, args) => (await t.all(sql, args))[0] || null, run: t.run }))
}
/** Local mode only: the whole database as bytes (for a backup download). */
export async function exportBackup() {
  const impl = await db()
  if (!impl.exportBytes) throw new Error('Backup download is only available in local mode')
  return impl.exportBytes()
}

export async function dropAll() {
  if (mode !== 'local') throw new Error('Reset is disabled when connected to a remote (Turso) database.')
  await tx(async (q) => {
    for (const t of TABLES) await q.run(`DELETE FROM ${t}`)
    await q.run(`DELETE FROM sqlite_sequence`).catch(() => {})
  })
}
