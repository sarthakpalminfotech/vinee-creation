// DB adapter: Turso (libSQL over HTTP) when env is configured, else local SQLite (sql.js) persisted in IndexedDB.
import { SCHEMA, MIGRATIONS, COLUMNS, TABLES, SCHEMA_VERSION } from './schema'

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});
const TURSO_URL = env.VITE_TURSO_DATABASE_URL
const TURSO_TOKEN = env.VITE_TURSO_AUTH_TOKEN
export const mode = TURSO_URL ? 'turso' : 'local'
/** Only exposed so the test harness can verify it never talks to a remote database. */
export const remoteUrl = TURSO_URL || ''

/** Statements sent to the database so far (tests assert that big saves stay within a handful of statements). */
let statements = 0
export const statementCount = () => statements
export const DB_UNREACHABLE = 'Could not reach the database — check the internet connection and try again'
/** Turns network / auth failures of the remote database into one readable message; SQL errors pass through. */
function friendly(e) {
  const msg = String(e?.message || e)
  if (/SQLITE_|constraint|no such (table|column)|syntax error|near "/i.test(msg) || /^SQLITE_/.test(String(e?.code || ''))) return e
  const err = new Error(DB_UNREACHABLE)
  err.cause = e
  return err
}

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
      statements += 1
      const st = db.prepare(sql)
      st.bind(clean(args))
      const rows = []
      while (st.step()) rows.push(st.getAsObject())
      st.free()
      return rows
    },
    run(sql, args) {
      statements += 1
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
    batch: (list) => serial(() => {
      db.run('BEGIN')
      try { for (const sql of list) exec.run(sql, []); db.run('COMMIT'); persist() } catch (e) { try { db.run('ROLLBACK') } catch { /* nothing to roll back */ } throw e }
    }),
    exportBytes: () => db.export(),
  }
}

async function makeTurso() {
  const { createClient } = await import('@libsql/client/web')
  const c = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })
  const rowsOf = (r) => r.rows.map((row) => Object.fromEntries(r.columns.map((col, i) => [col, row[i]])))
  const wrap = (ex) => ({
    async all(sql, args) {
      statements += 1
      try { return rowsOf(await ex.execute({ sql, args: clean(args) })) } catch (e) { throw friendly(e) }
    },
    async run(sql, args) {
      statements += 1
      try { const r = await ex.execute({ sql, args: clean(args) }); return { lastId: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected } } catch (e) { throw friendly(e) }
    },
  })
  const plain = wrap(c)
  return {
    ...plain,
    /** Many schema statements in ONE round trip (atomic). */
    async batch(list) {
      statements += 1
      try { await c.batch(list.map((sql) => ({ sql, args: [] })), 'write') } catch (e) { throw friendly(e) }
    },
    async transaction(fn) {
      let t
      try { t = await c.transaction('write') } catch (e) { throw friendly(e) }
      try {
        const out = await fn(wrap(t))
        try { await t.commit() } catch (e) { throw friendly(e) }
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

/** Adds missing columns and moves old single-godown data under a default branch. Idempotent. */
async function upgrade(impl) {
  // one query for every existing column instead of one PRAGMA per table
  const cols = await impl.all("SELECT m.name AS t, p.name AS c FROM sqlite_master m, pragma_table_info(m.name) p WHERE m.type='table'")
  const have = {}
  for (const r of cols) (have[r.t] ||= new Set()).add(r.c)
  const alters = []
  for (const [t, c, type] of COLUMNS) if (!have[t]?.has(c)) alters.push(`ALTER TABLE ${t} ADD COLUMN ${c} ${type}`)
  if (alters.length) await impl.batch(alters)
  const n = Number((await impl.all('SELECT COUNT(*) AS c FROM branches'))[0].c)
  if (n === 0) {
    const used = Number((await impl.all('SELECT (SELECT COUNT(*) FROM locations) + (SELECT COUNT(*) FROM grey_receipts) AS c'))[0].c)
    if (used > 0) {
      const { lastId } = await impl.run("INSERT INTO branches (name) VALUES ('Main Godown')")
      await impl.run('UPDATE locations SET branch_id=? WHERE branch_id IS NULL', [lastId])
      await impl.run("UPDATE grey_receipts SET branch_id=? WHERE branch_id IS NULL AND destination='GODOWN'", [lastId])
      await impl.run("UPDATE takas SET branch_id=? WHERE branch_id IS NULL AND receipt_id IN (SELECT id FROM grey_receipts WHERE destination='GODOWN')", [lastId])
    }
  }
}

/** Creates / upgrades the schema only when the stored schema_version differs from this code's version. */
async function prepare(impl) {
  await impl.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)')
  const row = (await impl.all("SELECT value FROM settings WHERE key='schema_version'"))[0]
  if (row && String(row.value) === String(SCHEMA_VERSION)) return
  await impl.batch(SCHEMA)
  await upgrade(impl)
  // Additive migrations: never fatal on their own (e.g. a unique index is skipped if old data already has duplicates).
  try { await impl.batch(MIGRATIONS.filter((m) => !m.optional).map((m) => m.sql)) } catch (e) {
    console.warn('Migration batch failed, retrying one by one:', e?.message)
    for (const m of MIGRATIONS) await impl.run(m.sql).catch((err) => console.warn('Migration skipped:', m.sql, err?.message))
  }
  for (const m of MIGRATIONS.filter((x) => x.optional)) await impl.run(m.sql).catch((err) => console.warn('Migration skipped:', m.sql, err?.message))
  await impl.run("INSERT INTO settings (key,value) VALUES ('schema_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [String(SCHEMA_VERSION)])
}

let ready
export function db() {
  if (!ready) {
    ready = (async () => {
      const impl = mode === 'turso' ? await makeTurso() : await makeLocal()
      await prepare(impl)
      return impl
    })()
    ready.catch(() => { ready = undefined }) // let the next call retry after a network failure
  }
  return ready
}

// ---------- change notification: any successful write bumps the version so open screens can reload ----------
let version = 0
const listeners = new Set()
export const getVersion = () => version
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function notifyChange() { version += 1; listeners.forEach((fn) => { try { fn(version) } catch { /* ignore */ } }) }

export const all = async (sql, args) => (await db()).all(sql, args)
export const one = async (sql, args) => (await all(sql, args))[0] || null
export const run = async (sql, args) => { const r = await (await db()).run(sql, args); notifyChange(); return r }
/** Run fn({all, one, run}) as one atomic transaction (all-or-nothing). Use ONLY the passed handle inside fn. */
export async function tx(fn) {
  const impl = await db()
  const out = await impl.transaction((t) => fn({ all: t.all, one: async (sql, args) => (await t.all(sql, args))[0] || null, run: t.run }))
  notifyChange()
  return out
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
