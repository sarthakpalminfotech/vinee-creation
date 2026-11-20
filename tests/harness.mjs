// Loads src/db/repo.js through Vite's SSR loader so tests run the real code against a throw-away database.
//   default                      → in-memory sql.js (local mode)
//   VINEE_TEST_DRIVER=libsql     → the Turso code path (makeTurso) running on @libsql/client against a temporary local file:
// Tests never read .env files and can never reach a remote database.
import { createServer } from 'vite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const driver = process.env.VINEE_TEST_DRIVER === 'libsql' || process.argv.includes('--libsql') ? 'libsql' : 'sqljs'

export async function loadRepo() {
  let dir, define = {}, alias = {}
  if (driver === 'libsql') {
    dir = mkdtempSync(join(tmpdir(), 'vinee-libsql-'))
    const url = 'file:' + join(dir, 'test.db').split('\\').join('/')
    define = { 'import.meta.env.VITE_TURSO_DATABASE_URL': JSON.stringify(url), 'import.meta.env.VITE_TURSO_AUTH_TOKEN': JSON.stringify('') }
    alias = { '@libsql/client/web': '@libsql/client' }
  }
  const server = await createServer({
    configFile: false, logLevel: 'silent', appType: 'custom',
    // tests must NEVER reach a real (Turso) database: do not read .env files, expose no VITE_ variables
    envDir: false, envPrefix: 'VINEE_TEST_ONLY_',
    define, resolve: { alias },
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: driver === 'libsql' ? { external: ['@libsql/client'] } : undefined,
  })
  const repo = await server.ssrLoadModule('/src/db/repo.js')
  const client = await server.ssrLoadModule('/src/db/client.js')
  // hard safety: only an in-memory sql.js DB or a local file: database is acceptable
  const safe = client.mode === 'local' || String(client.remoteUrl).startsWith('file:')
  if (!safe) { await server.close(); throw new Error('Refusing to run tests against a remote database') }
  const format = await server.ssrLoadModule('/src/lib/format.js')
  const schema = await server.ssrLoadModule('/src/db/schema.js')
  return { repo, client, format, schema, driver, loadModule: (p) => server.ssrLoadModule(p), close: async () => { await server.close(); if (dir) { try { rmSync(dir, { recursive: true, force: true, maxRetries: 3 }) } catch { /* Windows keeps the file open until exit; the OS temp folder is cleaned later */ } } } }
}
