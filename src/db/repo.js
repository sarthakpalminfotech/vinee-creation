// All domain data access. Pages must only use these functions (see specs/02-architecture.md).
import { all, one, run, dropAll } from './client'

export const STATUS_META = {
  GODOWN_GREY: { label: 'Grey · Godown', cls: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  MILL_GREY: { label: 'Grey · Mill', cls: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  IN_DYEING: { label: 'In Dyeing', cls: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  FINISHED: { label: 'Finished', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  FOLDED: { label: 'Ready', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  SOLD: { label: 'Sold', cls: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400' },
}
export const PIPELINE = ['GODOWN_GREY', 'MILL_GREY', 'IN_DYEING', 'FINISHED', 'FOLDED', 'SOLD']

export const today = () => new Date().toISOString().slice(0, 10)
const r2 = (n) => Math.round(Number(n) * 100) / 100
const qs = (arr) => arr.map(() => '?').join(',')
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

// ---------------------------------------------------------------- masters
const MASTER_COLS = {
  weaver_groups: ['name', 'contact', 'phone', 'city'],
  weavers: ['group_id', 'name', 'gstin', 'phone'],
  mills: ['name', 'contact', 'phone', 'city'],
  customers: ['name', 'contact', 'phone', 'city'],
  qualities: ['original_name', 'nick_name', 'taka_length', 'notes'],
  locations: ['shop', 'rack'],
  shade_charts: ['name'],
  shades: ['chart_id', 'number', 'name', 'hex'],
}
const USAGE = {
  weaver_groups: [['weavers', 'group_id'], ['grey_pos', 'group_id']],
  weavers: [['grey_receipts', 'weaver_id']],
  mills: [['grey_receipts', 'mill_id'], ['mill_dispatches', 'mill_id'], ['programs', 'mill_id']],
  customers: [['orders', 'customer_id']],
  qualities: [['grey_pos', 'quality_id'], ['programs', 'quality_id'], ['orders', 'quality_id']],
  locations: [['takas', 'location_id']],
  shade_charts: [['shades', 'chart_id'], ['programs', 'chart_id']],
  shades: [['program_lines', 'shade_id'], ['order_lines', 'shade_id']],
}

export async function saveMaster(table, obj) {
  const cols = MASTER_COLS[table]
  const vals = cols.map((c) => (obj[c] === '' ? null : obj[c]))
  if (obj.id) {
    await run(`UPDATE ${table} SET ${cols.map((c) => `${c}=?`).join(',')} WHERE id=?`, [...vals, obj.id])
    return obj.id
  }
  const { lastId } = await run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${qs(cols)})`, vals)
  return lastId
}

export async function removeMaster(table, id) {
  for (const [t, col] of USAGE[table] || []) {
    const r = await one(`SELECT COUNT(*) AS c FROM ${t} WHERE ${col}=?`, [id])
    if (Number(r.c) > 0) throw new Error(`Cannot delete — it is used in ${r.c} ${t.replace(/_/g, ' ')}.`)
  }
  await run(`DELETE FROM ${table} WHERE id=?`, [id])
}

export const listMills = () => all('SELECT * FROM mills ORDER BY name')
export const listCustomers = () => all('SELECT * FROM customers ORDER BY name')
export const listQualities = () => all('SELECT * FROM qualities ORDER BY nick_name')
export const listLocations = () => all('SELECT * FROM locations ORDER BY shop, rack')
export const listCharts = () => all('SELECT * FROM shade_charts ORDER BY name')
export const listShades = () =>
  all('SELECT s.*, c.name AS chart_name FROM shades s JOIN shade_charts c ON c.id=s.chart_id ORDER BY c.name, CAST(s.number AS REAL), s.number')
export const listWeavers = () =>
  all('SELECT w.*, g.name AS group_name FROM weavers w JOIN weaver_groups g ON g.id=w.group_id ORDER BY g.name, w.name')
export async function listWeaverGroups() {
  const [groups, weavers] = await Promise.all([all('SELECT * FROM weaver_groups ORDER BY name'), listWeavers()])
  return groups.map((g) => ({ ...g, firms: weavers.filter((w) => w.group_id === g.id) }))
}

async function nextNo(table, prefix) {
  const r = await one(`SELECT COUNT(*) AS c FROM ${table}`)
  return `${prefix}-${String(Number(r.c) + 1).padStart(4, '0')}`
}
export const nextPoNo = () => nextNo('grey_pos', 'PO')
export const nextOrderNo = () => nextNo('orders', 'SO')

// ---------------------------------------------------------------- takas
const TAKA_SQL = `SELECT t.*, r.challan_no, r.date AS receipt_date, r.destination, r.po_id, r.weaver_id,
  w.name AS weaver_name, g.id AS group_id, g.name AS group_name,
  p.po_no, p.quality_id, p.taka_length, q.nick_name, q.original_name,
  l.shop, l.rack, m.name AS mill_name, d.dispatch_no,
  pl.program_id, pl.shade_id, pr.program_no, s.number AS shade_no, s.hex AS shade_hex, s.name AS shade_name,
  fr.challan_no AS finished_challan, o.order_no
  FROM takas t
  JOIN grey_receipts r ON r.id=t.receipt_id
  JOIN grey_pos p ON p.id=r.po_id
  JOIN qualities q ON q.id=p.quality_id
  JOIN weavers w ON w.id=r.weaver_id
  JOIN weaver_groups g ON g.id=w.group_id
  LEFT JOIN locations l ON l.id=t.location_id
  LEFT JOIN mills m ON m.id=t.mill_id
  LEFT JOIN mill_dispatches d ON d.id=t.dispatch_id
  LEFT JOIN program_lines pl ON pl.id=t.program_line_id
  LEFT JOIN programs pr ON pr.id=pl.program_id
  LEFT JOIN shades s ON s.id=pl.shade_id
  LEFT JOIN finished_receipts fr ON fr.id=t.finished_receipt_id
  LEFT JOIN orders o ON o.id=t.order_id`

/** Per-taka shrinkage lineage. Formulas: specs/01-business.md */
export function withLineage(t) {
  const direct = t.destination === 'MILL'
  const nominal = Number(t.taka_length) || 100
  const grey = Number(t.grey_meter)
  const millGrey = t.mill_grey_meter != null ? Number(t.mill_grey_meter) : grey
  const finished = num(t.finished_meter)
  const folded = num(t.folded_meter)
  const weaverLoss = direct ? null : r2(nominal - grey)
  const finishLoss = finished != null ? r2(millGrey - finished) : null
  const foldLoss = folded != null && finished != null ? r2(finished - folded) : null
  const start = direct ? millGrey : nominal
  const end = folded ?? finished
  const totalLoss = end != null ? r2(start - end) : null
  return {
    ...t, direct, nominal, millGrey, weaverLoss, finishLoss, foldLoss, start, totalLoss,
    weaverPct: weaverLoss != null ? r2((weaverLoss / nominal) * 100) : null,
    finishPct: finishLoss != null ? r2((finishLoss / millGrey) * 100) : null,
    foldPct: foldLoss != null ? r2((foldLoss / finished) * 100) : null,
    totalPct: totalLoss != null ? r2((totalLoss / start) * 100) : null,
    label: `${t.challan_no}/${t.taka_no}`,
  }
}

export async function listTakas(where = '', args = []) {
  return (await all(`${TAKA_SQL} ${where} ORDER BY r.date, r.id, t.id`, args)).map(withLineage)
}

export async function assignLocation(ids, locationId) {
  if (!ids.length) return
  await run(`UPDATE takas SET location_id=? WHERE id IN (${qs(ids)})`, [locationId, ...ids])
}

// ---------------------------------------------------------------- grey PO
const PO_SQL = `SELECT p.*, g.name AS group_name, q.nick_name, q.original_name,
  (SELECT COALESCE(SUM(t.grey_meter),0) FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id WHERE r.po_id=p.id) AS received_m,
  (SELECT COUNT(*) FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id WHERE r.po_id=p.id) AS received_takas,
  (SELECT COUNT(*) FROM grey_receipts r WHERE r.po_id=p.id) AS receipt_count
  FROM grey_pos p JOIN weaver_groups g ON g.id=p.group_id JOIN qualities q ON q.id=p.quality_id`

function decoratePo(p) {
  const received = Number(p.received_m)
  const status = p.closed ? 'COMPLETED' : received <= 0 ? 'OPEN' : received >= p.meters ? 'COMPLETED' : 'PARTIAL'
  return {
    ...p, received_m: r2(received), status,
    pending_m: Math.max(0, r2(p.meters - received)),
    amount: r2(p.meters * p.rate),
    expected_takas: Math.round(p.meters / (p.taka_length || 100)),
    pct: Math.min(100, (received / p.meters) * 100),
    shortfall: status === 'COMPLETED' ? r2(p.meters - received) : null,
  }
}

export const listPOs = async () => (await all(`${PO_SQL} ORDER BY p.id DESC`)).map(decoratePo)
export async function getPO(id) {
  const p = await one(`${PO_SQL} WHERE p.id=?`, [id])
  if (!p) return null
  return { ...decoratePo(p), receipts: await listReceipts('WHERE r.po_id=?', [id]) }
}
export async function createPO(d) {
  const { lastId } = await run(
    `INSERT INTO grey_pos (po_no,po_date,group_id,quality_id,meters,rate,taka_length,due_date,notes,image_url) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [d.po_no, d.po_date, d.group_id, d.quality_id, Number(d.meters), Number(d.rate), Number(d.taka_length) || 100, d.due_date || null, d.notes || null, d.image_url || null],
  )
  return lastId
}
export const setPOClosed = (id, closed) => run('UPDATE grey_pos SET closed=? WHERE id=?', [closed ? 1 : 0, id])

// ---------------------------------------------------------------- grey receipts
const RC_SQL = `SELECT r.*, p.po_no, p.quality_id, p.taka_length, q.nick_name, q.original_name, w.name AS weaver_name, g.name AS group_name, m.name AS mill_name,
  (SELECT COUNT(*) FROM takas t WHERE t.receipt_id=r.id) AS taka_count,
  (SELECT COALESCE(SUM(grey_meter),0) FROM takas t WHERE t.receipt_id=r.id) AS total_m,
  (SELECT COUNT(*) FROM takas t WHERE t.receipt_id=r.id AND t.status='GODOWN_GREY') AS godown_count,
  (SELECT COUNT(*) FROM takas t WHERE t.receipt_id=r.id AND t.status='GODOWN_GREY' AND t.location_id IS NULL) AS unassigned_count
  FROM grey_receipts r JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id
  JOIN weavers w ON w.id=r.weaver_id JOIN weaver_groups g ON g.id=w.group_id LEFT JOIN mills m ON m.id=r.mill_id`

export const listReceipts = (where = '', args = []) => all(`${RC_SQL} ${where} ORDER BY r.date DESC, r.id DESC`, args)
export async function getReceipt(id) {
  const r = await one(`${RC_SQL} WHERE r.id=?`, [id])
  if (!r) return null
  return { ...r, takas: await listTakas('WHERE t.receipt_id=?', [id]) }
}

/** d: {po_id, weaver_id, challan_no, date, destination:'GODOWN'|'MILL', mill_id, location_id, image_url, notes, takas:[{taka_no, meter}]} */
export async function createReceipt(d) {
  if (!d.takas?.length) throw new Error('Add at least one taka')
  const toMill = d.destination === 'MILL'
  const { lastId } = await run(
    `INSERT INTO grey_receipts (po_id,weaver_id,challan_no,date,destination,mill_id,image_url,notes) VALUES (?,?,?,?,?,?,?,?)`,
    [d.po_id, d.weaver_id, d.challan_no, d.date, d.destination, toMill ? d.mill_id : null, d.image_url || null, d.notes || null],
  )
  const status = toMill ? 'MILL_GREY' : 'GODOWN_GREY'
  for (let i = 0; i < d.takas.length; i += 100) {
    const chunk = d.takas.slice(i, i + 100)
    const args = chunk.flatMap((t) => [lastId, String(t.taka_no), r2(t.meter), status, toMill ? null : d.location_id || null, toMill ? d.mill_id : null])
    await run(`INSERT INTO takas (receipt_id,taka_no,grey_meter,status,location_id,mill_id) VALUES ${chunk.map(() => '(?,?,?,?,?,?)').join(',')}`, args)
  }
  return lastId
}

// ---------------------------------------------------------------- mill dispatch
const DS_SQL = `SELECT d.*, m.name AS mill_name,
  (SELECT COUNT(*) FROM takas t WHERE t.dispatch_id=d.id) AS taka_count,
  (SELECT COALESCE(SUM(grey_meter),0) FROM takas t WHERE t.dispatch_id=d.id) AS total_m,
  (SELECT GROUP_CONCAT(DISTINCT q.nick_name) FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id WHERE t.dispatch_id=d.id) AS qualities
  FROM mill_dispatches d JOIN mills m ON m.id=d.mill_id`
export const listDispatches = () => all(`${DS_SQL} ORDER BY d.id DESC`)
export async function getDispatch(id) {
  const d = await one(`${DS_SQL} WHERE d.id=?`, [id])
  if (!d) return null
  return { ...d, takas: await listTakas('WHERE t.dispatch_id=?', [id]) }
}
export async function createDispatch({ mill_id, date, notes, taka_ids }) {
  if (!taka_ids.length) throw new Error('Select takas to send')
  const no = await nextNo('mill_dispatches', 'DC')
  const { lastId } = await run('INSERT INTO mill_dispatches (dispatch_no,date,mill_id,notes) VALUES (?,?,?,?)', [no, date, mill_id, notes || null])
  await run(`UPDATE takas SET status='MILL_GREY', mill_id=?, dispatch_id=? WHERE id IN (${qs(taka_ids)}) AND status='GODOWN_GREY'`, [mill_id, lastId, ...taka_ids])
  return lastId
}

// ---------------------------------------------------------------- dyeing programs
const PG_SQL = `SELECT pr.*, m.name AS mill_name, q.nick_name, q.original_name, c.name AS chart_name,
  (SELECT COALESCE(SUM(taka_count),0) FROM program_lines WHERE program_id=pr.id) AS total_takas,
  (SELECT COUNT(*) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE pl.program_id=pr.id AND t.finished_receipt_id IS NOT NULL) AS received_takas,
  (SELECT COALESCE(SUM(t.grey_meter),0) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE pl.program_id=pr.id) AS grey_m
  FROM programs pr JOIN mills m ON m.id=pr.mill_id JOIN qualities q ON q.id=pr.quality_id JOIN shade_charts c ON c.id=pr.chart_id`
const LINES_SQL = `SELECT pl.*, s.number AS shade_no, s.name AS shade_name, s.hex,
  (SELECT COUNT(*) FROM takas t WHERE t.program_line_id=pl.id) AS allocated,
  (SELECT COUNT(*) FROM takas t WHERE t.program_line_id=pl.id AND t.finished_receipt_id IS NOT NULL) AS received
  FROM program_lines pl JOIN shades s ON s.id=pl.shade_id`
const progStatus = (p) => (Number(p.received_takas) === 0 ? 'PENDING' : Number(p.received_takas) >= Number(p.total_takas) ? 'DONE' : 'PARTIAL')

export async function listPrograms() {
  const [progs, lines] = await Promise.all([all(`${PG_SQL} ORDER BY pr.id DESC`), all(LINES_SQL)])
  return progs.map((p) => ({ ...p, status: progStatus(p), lines: lines.filter((l) => l.program_id === p.id) }))
}
export async function getProgram(id) {
  const p = await one(`${PG_SQL} WHERE pr.id=?`, [id])
  if (!p) return null
  const [lines, takas, receipts] = await Promise.all([
    all(`${LINES_SQL} WHERE pl.program_id=? ORDER BY pl.id`, [id]),
    listTakas('WHERE pl.program_id=?', [id]),
    listFinishedReceipts('WHERE fr.program_id=?', [id]),
  ])
  return { ...p, status: progStatus(p), lines, takas, receipts }
}
export const millGreyTakas = (millId, qualityId) =>
  listTakas(`WHERE t.status='MILL_GREY' AND t.mill_id=? AND p.quality_id=?`, [millId, qualityId])

/** Auto-allocates takas FIFO from mill grey stock to each shade line. */
export async function createProgram({ mill_id, quality_id, chart_id, date, notes, lines }) {
  const valid = lines.filter((l) => l.shade_id && Number(l.taka_count) > 0)
  if (!valid.length) throw new Error('Add at least one shade line')
  const avail = await millGreyTakas(mill_id, quality_id)
  const need = valid.reduce((s, l) => s + Number(l.taka_count), 0)
  if (need > avail.length) throw new Error(`Only ${avail.length} grey takas available at this mill`)
  const no = await nextNo('programs', 'PG')
  const { lastId } = await run('INSERT INTO programs (program_no,date,mill_id,quality_id,chart_id,notes) VALUES (?,?,?,?,?,?)', [no, date, mill_id, quality_id, chart_id, notes || null])
  let cursor = 0
  for (const l of valid) {
    const { lastId: lineId } = await run('INSERT INTO program_lines (program_id,shade_id,taka_count) VALUES (?,?,?)', [lastId, l.shade_id, Number(l.taka_count)])
    const ids = avail.slice(cursor, cursor + Number(l.taka_count)).map((t) => t.id)
    cursor += ids.length
    await run(`UPDATE takas SET status='IN_DYEING', program_line_id=? WHERE id IN (${qs(ids)})`, [lineId, ...ids])
  }
  return lastId
}

// ---------------------------------------------------------------- finished receipts
const FR_SQL = `SELECT fr.*, pr.program_no, pr.mill_id, m.name AS mill_name, q.nick_name,
  (SELECT COUNT(*) FROM takas t WHERE t.finished_receipt_id=fr.id) AS taka_count,
  (SELECT COALESCE(SUM(COALESCE(mill_grey_meter, grey_meter)),0) FROM takas t WHERE t.finished_receipt_id=fr.id) AS grey_m,
  (SELECT COALESCE(SUM(finished_meter),0) FROM takas t WHERE t.finished_receipt_id=fr.id) AS finished_m
  FROM finished_receipts fr JOIN programs pr ON pr.id=fr.program_id JOIN mills m ON m.id=pr.mill_id JOIN qualities q ON q.id=pr.quality_id`
export const listFinishedReceipts = (where = '', args = []) => all(`${FR_SQL} ${where} ORDER BY fr.id DESC`, args)

/** rows: [{id, mill_grey_meter, finished_meter}] */
export async function createFinishedReceipt({ program_id, challan_no, date, image_url, notes, rows }) {
  if (!rows.length) throw new Error('Select received takas')
  const { lastId } = await run('INSERT INTO finished_receipts (program_id,challan_no,date,image_url,notes) VALUES (?,?,?,?,?)', [program_id, challan_no, date, image_url || null, notes || null])
  for (const r of rows) {
    await run(`UPDATE takas SET status='FINISHED', finished_receipt_id=?, mill_grey_meter=?, finished_meter=? WHERE id=?`, [lastId, r2(r.mill_grey_meter), r2(r.finished_meter), r.id])
  }
  return lastId
}

// ---------------------------------------------------------------- folding
export async function foldTakas(rows, date = today()) {
  for (const r of rows) await run(`UPDATE takas SET status='FOLDED', folded_meter=?, folded_on=? WHERE id=? AND status='FINISHED'`, [r2(r.folded_meter), date, r.id])
}

// ---------------------------------------------------------------- customer orders
const OR_SQL = `SELECT o.*, c.name AS customer_name, c.city AS customer_city, q.nick_name, q.original_name,
  (SELECT COALESCE(SUM(taka_count),0) FROM order_lines WHERE order_id=o.id) AS total_takas,
  (SELECT COUNT(*) FROM takas t WHERE t.order_id=o.id) AS allocated
  FROM orders o JOIN customers c ON c.id=o.customer_id JOIN qualities q ON q.id=o.quality_id`
const OL_SQL = `SELECT ol.*, s.number AS shade_no, s.name AS shade_name, s.hex,
  (SELECT COUNT(*) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE t.order_id=ol.order_id AND pl.shade_id=ol.shade_id) AS allocated
  FROM order_lines ol JOIN shades s ON s.id=ol.shade_id`
export async function listOrders() {
  const [orders, lines] = await Promise.all([all(`${OR_SQL} ORDER BY o.id DESC`), all(OL_SQL)])
  return orders.map((o) => ({ ...o, lines: lines.filter((l) => l.order_id === o.id) }))
}
export async function getOrder(id) {
  const o = await one(`${OR_SQL} WHERE o.id=?`, [id])
  if (!o) return null
  const [lines, takas] = await Promise.all([all(`${OL_SQL} WHERE ol.order_id=? ORDER BY ol.id`, [id]), listTakas('WHERE t.order_id=?', [id])])
  return { ...o, lines, takas }
}
export async function createOrder({ order_no, date, customer_id, quality_id, notes, lines }) {
  const valid = lines.filter((l) => l.shade_id && Number(l.taka_count) > 0)
  if (!valid.length) throw new Error('Add at least one shade line')
  const { lastId } = await run('INSERT INTO orders (order_no,date,customer_id,quality_id,notes) VALUES (?,?,?,?,?)', [order_no, date, customer_id, quality_id, notes || null])
  for (const l of valid) await run('INSERT INTO order_lines (order_id,shade_id,taka_count) VALUES (?,?,?)', [lastId, l.shade_id, Number(l.taka_count)])
  return lastId
}
/** Allocates READY (folded) takas FIFO to each line → SOLD. */
export async function allocateOrder(id) {
  const o = await getOrder(id)
  let allocated = 0, short = 0
  for (const l of o.lines) {
    const need = l.taka_count - l.allocated
    if (need <= 0) continue
    const ready = await listTakas(`WHERE t.status='FOLDED' AND p.quality_id=? AND pl.shade_id=?`, [o.quality_id, l.shade_id])
    const ids = ready.slice(0, need).map((t) => t.id)
    if (ids.length) await run(`UPDATE takas SET status='SOLD', order_id=? WHERE id IN (${qs(ids)})`, [id, ...ids])
    allocated += ids.length
    short += need - ids.length
  }
  if (short === 0) await run(`UPDATE orders SET status='DONE' WHERE id=?`, [id])
  return { allocated, short }
}

export async function closeOrder(id) {
  return await run(`UPDATE orders SET status='DONE' WHERE id=?`, [id])
}

/** Stock position for one quality: grey (shade-free) + per-shade dyeing / finished / ready. */
export async function availability(qualityId) {
  const takas = await listTakas(`WHERE p.quality_id=? AND t.status!='SOLD'`, [qualityId])
  const acc = () => ({ takas: 0, m: 0 })
  const add = (a, m) => { a.takas += 1; a.m = r2(a.m + Number(m || 0)) }
  const res = { godownGrey: acc(), millGrey: acc(), dyeing: acc(), finished: acc(), ready: acc(), byShade: {} }
  for (const t of takas) {
    if (t.status === 'GODOWN_GREY') add(res.godownGrey, t.grey_meter)
    if (t.status === 'MILL_GREY') add(res.millGrey, t.grey_meter)
    if (t.shade_id) {
      const s = (res.byShade[t.shade_id] ||= { shade_id: t.shade_id, shade_no: t.shade_no, hex: t.shade_hex, dyeing: acc(), finished: acc(), ready: acc() })
      if (t.status === 'IN_DYEING') { add(s.dyeing, t.grey_meter); add(res.dyeing, t.grey_meter) }
      if (t.status === 'FINISHED') { add(s.finished, t.finished_meter); add(res.finished, t.finished_meter) }
      if (t.status === 'FOLDED') { add(s.ready, t.folded_meter); add(res.ready, t.folded_meter) }
    }
  }
  return res
}

// ---------------------------------------------------------------- dashboard
export async function dashboard() {
  const [byStatus, pos, folded, receipts, dispatches, programs, finished, orders] = await Promise.all([
    all(`SELECT status, COUNT(*) AS c, COALESCE(SUM(COALESCE(folded_meter, finished_meter, grey_meter)),0) AS m FROM takas GROUP BY status`),
    listPOs(),
    listTakas(`WHERE t.folded_meter IS NOT NULL`),
    listReceipts(), listDispatches(), listPrograms(), listFinishedReceipts(), listOrders(),
  ])
  const status = Object.fromEntries(PIPELINE.map((s) => [s, { c: 0, m: 0 }]))
  byStatus.forEach((r) => { status[r.status] = { c: Number(r.c), m: r2(r.m) } })
  const openPos = pos.filter((p) => p.status !== 'COMPLETED')
  const avg = (arr) => (arr.length ? r2(arr.reduce((s, v) => s + v, 0) / arr.length) : 0)
  const activity = [
    ...receipts.slice(0, 5).map((r) => ({ kind: 'receipt', date: r.date, title: `Grey challan ${r.challan_no}`, sub: `${r.weaver_name} · ${r.taka_count} taka · ${r.nick_name}`, to: `/receipts/${r.id}` })),
    ...dispatches.slice(0, 5).map((d) => ({ kind: 'dispatch', date: d.date, title: `${d.dispatch_no} sent to mill`, sub: `${d.mill_name} · ${d.taka_count} taka`, to: `/dispatch/${d.id}` })),
    ...programs.slice(0, 5).map((p) => ({ kind: 'program', date: p.date, title: `Program ${p.program_no}`, sub: `${p.mill_name} · ${p.nick_name} · ${p.total_takas} taka`, to: `/programs/${p.id}` })),
    ...finished.slice(0, 5).map((f) => ({ kind: 'finished', date: f.date, title: `Finished challan ${f.challan_no}`, sub: `${f.program_no} · ${f.taka_count} taka`, to: `/programs/${f.program_id}` })),
    ...orders.slice(0, 5).map((o) => ({ kind: 'order', date: o.date, title: `Order ${o.order_no}`, sub: `${o.customer_name} · ${o.nick_name} · ${o.total_takas} taka`, to: `/orders/${o.id}` })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8)
  return {
    status,
    openPoCount: openPos.length,
    pendingPoM: r2(openPos.reduce((s, p) => s + p.pending_m, 0)),
    wastage: {
      weaver: avg(folded.filter((t) => t.weaverPct != null).map((t) => t.weaverPct)),
      finish: avg(folded.map((t) => t.finishPct).filter((v) => v != null)),
      fold: avg(folded.map((t) => t.foldPct).filter((v) => v != null)),
      total: avg(folded.map((t) => t.totalPct).filter((v) => v != null)),
      count: folded.length,
    },
    openOrders: orders.filter((o) => o.status === 'OPEN').length,
    activity,
  }
}

// ---------------------------------------------------------------- setup
export async function ensureSeed() {
  const r = await one('SELECT COUNT(*) AS c FROM qualities')
  if (Number(r.c) === 0) {
    const { seed } = await import('./seed')
    await seed()
  }
}
export async function resetDemo() {
  await dropAll()
  const { seed } = await import('./seed')
  await seed()
}
export async function clearAll() {
  await dropAll()
}
