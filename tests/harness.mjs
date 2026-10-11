// Loads src/db/repo.js through Vite's SSR loader so tests run the real code against an in-memory sql.js DB.
import { createServer } from 'vite'

export async function loadRepo() {
  const server = await createServer({
    configFile: false, logLevel: 'silent', appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  const repo = await server.ssrLoadModule('/src/db/repo.js')
  const client = await server.ssrLoadModule('/src/db/client.js')
  return { repo, client, close: () => server.close() }
}
