import { loadRepo } from './harness.mjs'
const { repo, client, close } = await loadRepo()
console.log('mode', client.mode)
await repo.ensureSeed()
const d = await repo.dashboard()
console.log(JSON.stringify(d.status), d.openPoCount, d.pendingPoM)
const pos = await repo.listPOs(); console.log('POs', pos.map(p => [p.po_no, p.status, p.received_m]))
const tk = await repo.listTakas(); console.log('takas', tk.length)
await close()
