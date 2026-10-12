// All domain data access. Pages must only use these functions (see specs/02-architecture.md).
import { all, one, run, tx, dropAll, mode } from './client'

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
const base = { all, one, run }
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
const bad = (msg) => { throw new Error(msg) }
const nowIso = () => new Date().toISOString()
/** Meters must be > 0 with at most 2 decimals. Returns the number rounded to 2dp. */
function meters2(v, label) {
  const raw = typeof v === 'string' ? v.trim() : v
  const n = Number(raw)
  if (raw === '' || raw === null || raw === undefined || !Number.isFinite(n) || n <= 0) bad(`${label}: enter meters greater than 0`)
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) bad(`${label}: meters can have at most 2 decimals`)
  return r2(n)
}
export const locLabel = (shop, rack, branch) => (shop ? `${branch ? `${branch} / ` : ''}${shop} / ${rack}` : 'No rack assigned')

// ---------------------------------------------------------------- masters
const MASTER_COLS = {
  weaver_groups: ['name', 'contact', 'phone', 'city'],
  weavers: ['group_id', 'name', 'gstin', 'phone'],
  mills: ['name', 'contact', 'phone', 'city'],
  customers: ['name', 'contact', 'phone', 'city'],
  qualities: ['original_name', 'nick_name', 'taka_length', 'notes'],
  branches: ['name', 'city', 'address', 'phone'],
  locations: ['branch_id', 'shop', 'rack'],
  items: ['code', 'quality_id', 'shade_id', 'notes'],
  shade_charts: ['name'],
  shades: ['chart_id', 'number', 'name', 'hex'],
}
const USAGE = {
  weaver_groups: [['weavers', 'group_id'], ['grey_pos', 'group_id']],
  weavers: [['grey_receipts', 'weaver_id']],
  mills: [['grey_receipts', 'mill_id'], ['mill_dispatches', 'mill_id'], ['programs', 'mill_id'], ['takas', 'mill_id']],
  customers: [['orders', 'customer_id']],
  qualities: [['grey_pos', 'quality_id'], ['programs', 'quality_id'], ['orders', 'quality_id'], ['items', 'quality_id']],
  branches: [['locations', 'branch_id'], ['grey_receipts', 'branch_id'], ['takas', 'branch_id']],
  items: [['program_lines', 'item_id'], ['order_lines', 'item_id']],
  locations: [['takas', 'location_id'], ['taka_moves', 'from_location_id'], ['taka_moves', 'to_location_id']],
  shade_charts: [['shades', 'chart_id'], ['programs', 'chart_id']],
  shades: [['program_lines', 'shade_id'], ['order_lines', 'shade_id'], ['items', 'shade_id']],
}

const REQUIRED = {
  weaver_groups: ['name'], weavers: ['group_id', 'name'], mills: ['name'], customers: ['name'],
  qualities: ['original_name', 'nick_name', 'taka_length'], branches: ['name'], locations: ['branch_id', 'shop', 'rack'], items: ['code', 'quality_id'],
  shade_charts: ['name'], shades: ['chart_id', 'number', 'hex'],
}
const UNIQUE = {
  weaver_groups: ['name'], weavers: ['group_id', 'name'], mills: ['name'], customers: ['name'],
  qualities: ['nick_name'], branches: ['name'], locations: ['branch_id', 'shop', 'rack'], items: ['code'], shade_charts: ['name'], shades: ['chart_id', 'number'],
}

export async function saveMaster(table, obj) {
  const cols = MASTER_COLS[table]
  const clean = {}
  for (const c of cols) {
    const v = typeof obj[c] === 'string' ? obj[c].trim() : obj[c]
    clean[c] = v === '' ? null : v
  }
  for (const c of REQUIRED[table] || []) if (clean[c] === null || clean[c] === undefined) bad(`${c.replace(/_/g, ' ')} is required`)
  if (table === 'qualities') { clean.taka_length = Number(clean.taka_length); if (!(clean.taka_length > 0)) bad('Taka length must be greater than 0') }
  if (table === 'shades' && !/^#[0-9a-fA-F]{6}$/.test(clean.hex)) bad('Colour must be a hex value like #A1B2C3')
  if (table === 'items') {
    clean.code = String(clean.code).toUpperCase().replace(/\s+/g, '')
    if (clean.shade_id) {
      const pair = await one('SELECT code FROM items WHERE quality_id=? AND shade_id=? AND id<>?', [clean.quality_id, clean.shade_id, obj.id || 0])
      if (pair) bad(`This quality + shade already has item code ${pair.code}`)
    }
  }
  const uq = UNIQUE[table]
  if (uq) {
    const where = uq.map((c) => (typeof clean[c] === 'string' ? `LOWER(TRIM(${c}))=?` : `${c}=?`)).join(' AND ')
    const args = uq.map((c) => (typeof clean[c] === 'string' ? clean[c].toLowerCase() : clean[c]))
    const dup = await one(`SELECT id FROM ${table} WHERE ${where} AND id<>?`, [...args, obj.id || 0])
    if (dup) bad(`Already exists: ${uq.map((c) => clean[c]).join(' / ')}`)
  }
  const vals = cols.map((c) => clean[c])
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
export const listBranches = () => all('SELECT * FROM branches ORDER BY name')
export const listLocations = () =>
  all('SELECT l.*, b.name AS branch_name FROM locations l LEFT JOIN branches b ON b.id=l.branch_id ORDER BY b.name, l.shop, l.rack')
export const listItems = () =>
  all(`SELECT i.*, q.nick_name, q.original_name, s.number AS shade_no, s.name AS shade_name, s.hex, s.chart_id, c.name AS chart_name
    FROM items i JOIN qualities q ON q.id=i.quality_id LEFT JOIN shades s ON s.id=i.shade_id LEFT JOIN shade_charts c ON c.id=s.chart_id
    ORDER BY q.nick_name, c.name, CAST(s.number AS REAL), s.number`)
/** Suggested unique item code: initials of the nickname + shade number, e.g. "Gold Lava" + 37 → GL-37. */
export function suggestItemCode(nick, shadeNo) {
  const words = String(nick || '').trim().split(/\s+/).filter(Boolean)
  const ini = (words.length > 1 ? words.map((w) => w[0]).join('') : words[0]?.slice(0, 3) || 'IT').toUpperCase()
  return shadeNo ? `${ini}-${String(shadeNo).toUpperCase().replace(/\s+/g, '')}` : ini
}
/** Creates an item (quality + shade) for every shade of a chart that has none yet. Returns how many were added. */
export async function generateItems(qualityId, chartId) {
  if (!qualityId || !chartId) bad('Choose a quality and a shade chart')
  return tx(async (q) => {
    const quality = await q.one('SELECT nick_name FROM qualities WHERE id=?', [qualityId])
    if (!quality) bad('Quality not found')
    const shades = await q.all('SELECT * FROM shades WHERE chart_id=? ORDER BY CAST(number AS REAL), number', [chartId])
    let added = 0
    for (const s of shades) {
      if (await q.one('SELECT id FROM items WHERE quality_id=? AND shade_id=?', [qualityId, s.id])) continue
      const stem = suggestItemCode(quality.nick_name, s.number)
      let code = stem, n = 1
      while (await q.one('SELECT id FROM items WHERE LOWER(code)=?', [code.toLowerCase()])) code = `${stem}-${++n}`
      await q.run('INSERT INTO items (code,quality_id,shade_id) VALUES (?,?,?)', [code, qualityId, s.id])
      added += 1
    }
    return added
  })
}
export const listCharts = () => all('SELECT * FROM shade_charts ORDER BY name')
export const listShades = () =>
  all('SELECT s.*, c.name AS chart_name FROM shades s JOIN shade_charts c ON c.id=s.chart_id ORDER BY c.name, CAST(s.number AS REAL), s.number')
export const listWeavers = () =>
  all('SELECT w.*, g.name AS group_name FROM weavers w JOIN weaver_groups g ON g.id=w.group_id ORDER BY g.name, w.name')
export async function listWeaverGroups() {
  const [groups, weavers] = await Promise.all([all('SELECT * FROM weaver_groups ORDER BY name'), listWeavers()])
  return groups.map((g) => ({ ...g, firms: weavers.filter((w) => w.group_id === g.id) }))
}

async function nextNo(table, prefix, q = base) {
  const r = await q.one(`SELECT COALESCE(MAX(id),0) AS c FROM ${table}`)
  return `${prefix}-${String(Number(r.c) + 1).padStart(4, '0')}`
}
export const nextPoNo = () => nextNo('grey_pos', 'PO')
export const nextOrderNo = () => nextNo('orders', 'SO')

// ---------------------------------------------------------------- takas
const TAKA_SQL = `SELECT t.*, r.challan_no, r.date AS receipt_date, r.destination, r.po_id, r.weaver_id,
  w.name AS weaver_name, g.id AS group_id, g.name AS group_name,
  p.po_no, p.quality_id, p.taka_length, q.nick_name, q.original_name,
  l.shop, l.rack, b.name AS branch_name, COALESCE(it.code, (SELECT i2.code FROM items i2 WHERE i2.quality_id=p.quality_id AND i2.shade_id=pl.shade_id ORDER BY i2.id LIMIT 1)) AS item_code, m.name AS mill_name, d.dispatch_no,
  pl.program_id, pl.shade_id, pr.program_no, pr.mill_id AS program_mill_id, pm.name AS program_mill_name,
  s.number AS shade_no, s.hex AS shade_hex, s.name AS shade_name,
  fr.challan_no AS finished_challan, o.order_no
  FROM takas t
  JOIN grey_receipts r ON r.id=t.receipt_id
  JOIN grey_pos p ON p.id=r.po_id
  JOIN qualities q ON q.id=p.quality_id
  JOIN weavers w ON w.id=r.weaver_id
  JOIN weaver_groups g ON g.id=w.group_id
  LEFT JOIN locations l ON l.id=t.location_id
  LEFT JOIN branches b ON b.id=t.branch_id
  LEFT JOIN mills m ON m.id=t.mill_id
  LEFT JOIN mill_dispatches d ON d.id=t.dispatch_id
  LEFT JOIN program_lines pl ON pl.id=t.program_line_id
  LEFT JOIN items it ON it.id=pl.item_id
  LEFT JOIN programs pr ON pr.id=pl.program_id
  LEFT JOIN mills pm ON pm.id=pr.mill_id
  LEFT JOIN shades s ON s.id=pl.shade_id
  LEFT JOIN finished_receipts fr ON fr.id=t.finished_receipt_id
  LEFT JOIN orders o ON o.id=t.order_id`

/**
 * Per-taka shrinkage chain (audit brief §2.9):
 *   weaver grey meter → [mill grey meter] → finished meter → folded meter.
 * Start = weaver challan meter; for direct-to-mill takas the weaver step is left out and the chain
 * starts at the mill's grey meter. `weaverLoss` (vs nominal taka length) is informational only.
 */
export function withLineage(t) {
  const direct = t.destination === 'MILL'
  const nominal = Number(t.taka_length) || 100
  const grey = Number(t.grey_meter)
  const millGrey = t.mill_grey_meter != null ? Number(t.mill_grey_meter) : grey
  const finished = num(t.finished_meter)
  const folded = num(t.folded_meter)
  const weaverLoss = direct ? null : r2(nominal - grey)
  const greyToMill = direct ? null : r2(grey - millGrey)
  const finishLoss = finished != null ? r2(millGrey - finished) : null
  const foldLoss = folded != null && finished != null ? r2(finished - folded) : null
  const start = direct ? millGrey : grey
  const end = folded ?? finished
  const totalLoss = end != null ? r2(start - end) : null
  return {
    ...t, direct, nominal, millGrey, weaverLoss, greyToMill, finishLoss, foldLoss, start, end, totalLoss,
    weaverPct: weaverLoss != null ? r2((weaverLoss / nominal) * 100) : null,
    finishPct: finishLoss != null ? r2((finishLoss / millGrey) * 100) : null,
    foldPct: foldLoss != null ? r2((foldLoss / finished) * 100) : null,
    totalPct: totalLoss != null ? r2((totalLoss / start) * 100) : null,
    label: `${t.challan_no}/${t.taka_no}`,
  }
}

export async function listTakas(where = '', args = [], q = base) {
  return (await q.all(`${TAKA_SQL} ${where} ORDER BY r.date, r.id, t.id`, args)).map(withLineage)
}

// ---- taka state machine ---------------------------------------------------
// GODOWN_GREY → MILL_GREY → IN_DYEING → FINISHED → FOLDED → SOLD   (direct receipts start at MILL_GREY)
// Every transition is checked here (server-side of the UI) and logged in taka_moves.

async function insertMoves(q, list) {
  const at = nowIso()
  for (const part of chunks(list, 80)) {
    await q.run(
      `INSERT INTO taka_moves (taka_id,at,from_status,to_status,from_location_id,to_location_id,mill_id,ref_type,ref_id,note) VALUES ${part.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',')}`,
      part.flatMap((m) => [m.taka_id, at, m.from_status ?? null, m.to_status, m.from_location_id ?? null, m.to_location_id ?? null, m.mill_id ?? null, m.ref_type ?? null, m.ref_id ?? null, m.note ?? null]),
    )
  }
}

/** Loads the takas by id and demands every one is in `status`. Throws a readable error otherwise. */
async function requireTakas(q, ids, status, action) {
  const uniq = [...new Set(ids.map(Number))]
  if (uniq.length !== ids.length) bad('The same taka was selected more than once')
  const found = []
  for (const part of chunks(uniq, 400)) {
    found.push(...(await q.all(
      `SELECT t.id, t.status, t.location_id, t.branch_id, t.mill_id, t.program_line_id, t.taka_no, r.challan_no FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id WHERE t.id IN (${qs(part)})`, part)))
  }
  if (found.length !== uniq.length) bad('Some selected takas no longer exist')
  const wrong = found.filter((t) => t.status !== status)
  if (wrong.length) {
    const sample = wrong.slice(0, 5).map((t) => `${t.challan_no}/${t.taka_no} (${STATUS_META[t.status]?.label || t.status})`).join(', ')
    bad(`Cannot ${action}: ${wrong.length} taka(s) are not "${STATUS_META[status].label}" — ${sample}${wrong.length > 5 ? '…' : ''}`)
  }
  return found
}

async function updateTakas(q, ids, setSql, setArgs, whereStatus) {
  let changed = 0
  for (const part of chunks(ids, 400)) {
    const r = await q.run(`UPDATE takas SET ${setSql} WHERE id IN (${qs(part)}) AND status=?`, [...setArgs, ...part, whereStatus])
    changed += r.changes
  }
  if (changed !== ids.length) bad('Some takas changed while saving — nothing was saved, please reload and try again')
}

export async function assignLocation(ids, locationId) {
  if (!ids?.length) bad('Select at least one taka')
  if (!locationId) bad('Choose a rack')
  return tx(async (q) => {
    const loc = await q.one('SELECT id, branch_id FROM locations WHERE id=?', [locationId])
    if (!loc) bad('That rack does not exist')
    const rows = await requireTakas(q, ids, 'GODOWN_GREY', 'assign a rack')
    const other = rows.filter((t) => loc.branch_id && t.branch_id && Number(t.branch_id) !== Number(loc.branch_id))
    if (other.length) bad(`${other.length} selected taka(s) were received at another branch — a rack can only hold grey of its own branch`)
    const moving = rows.filter((t) => Number(t.location_id) !== Number(locationId))
    if (moving.length) {
      for (const part of chunks(moving.map((t) => t.id), 400)) {
        await q.run(`UPDATE takas SET location_id=? WHERE id IN (${qs(part)}) AND status='GODOWN_GREY'`, [locationId, ...part])
      }
      await insertMoves(q, moving.map((t) => ({
        taka_id: t.id, from_status: 'GODOWN_GREY', to_status: 'GODOWN_GREY', from_location_id: t.location_id, to_location_id: locationId,
        note: t.location_id ? 'MOVE' : 'ASSIGN',
      })))
    }
    return moving.length
  })
}

/** Full movement history of one taka (oldest first). */
export const getTakaHistory = (takaId) =>
  all(`SELECT mv.*, lf.shop AS from_shop, lf.rack AS from_rack, lt.shop AS to_shop, lt.rack AS to_rack, m.name AS mill_name
    FROM taka_moves mv LEFT JOIN locations lf ON lf.id=mv.from_location_id LEFT JOIN locations lt ON lt.id=mv.to_location_id LEFT JOIN mills m ON m.id=mv.mill_id
    WHERE mv.taka_id=? ORDER BY mv.id`, [takaId])

/** Pure helper: group takas by their rack → [{key,label,shop,rack,takas,count,meters}] sorted by shop/rack. */
export function groupPickList(takas, locOf = (t) => ({ shop: t.shop, rack: t.rack, id: t.location_id, branch: t.branch_name })) {
  const map = new Map()
  for (const t of takas) {
    const l = locOf(t)
    const key = l.id ?? `none:${l.branch || ''}`
    if (!map.has(key)) map.set(key, { key, shop: l.shop || '', rack: l.rack || '', branch: l.branch || '', label: locLabel(l.shop, l.rack, l.branch), takas: [] })
    map.get(key).takas.push(t)
  }
  const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })
  return [...map.values()]
    .map((g) => ({ ...g, takas: g.takas.sort((a, b) => natural(a.taka_no, b.taka_no)), count: g.takas.length, meters: r2(g.takas.reduce((s, t) => s + Number(t.grey_meter), 0)) }))
    .sort((a, b) => natural(a.branch, b.branch) || (a.shop === '') - (b.shop === '') || natural(a.shop, b.shop) || natural(a.rack, b.rack))
}

// ---------------------------------------------------------------- grey PO
const PO_SQL = `SELECT p.*, g.name AS group_name, q.nick_name, q.original_name,
  (SELECT ROUND(COALESCE(SUM(t.grey_meter),0),2) FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id WHERE r.po_id=p.id) AS received_m,
  (SELECT COUNT(*) FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id WHERE r.po_id=p.id) AS received_takas,
  (SELECT COUNT(*) FROM grey_receipts r WHERE r.po_id=p.id) AS receipt_count
  FROM grey_pos p JOIN weaver_groups g ON g.id=p.group_id JOIN qualities q ON q.id=p.quality_id`

export const PO_STATUS_META = {
  OPEN: { label: 'Open', variant: 'primary' },
  PARTIAL: { label: 'Partly received', variant: 'warning' },
  RECEIVED: { label: 'Received', variant: 'success' },
  CLOSED: { label: 'Closed (short)', variant: 'danger' },
}

/** Status per audit brief R-PO-2. shortfall = ordered − received (weaver shrinkage), shown once received/closed. */
function decoratePo(p) {
  const received = r2(p.received_m)
  const full = received >= Number(p.meters)
  const status = p.closed ? (full ? 'RECEIVED' : 'CLOSED') : received <= 0 ? 'OPEN' : full ? 'RECEIVED' : 'PARTIAL'
  const done = status === 'RECEIVED' || status === 'CLOSED'
  const shortfall = done ? r2(p.meters - received) : null
  return {
    ...p, received_m: received, status,
    pending_m: Math.max(0, r2(p.meters - received)),
    amount: r2(p.meters * p.rate),
    expected_takas: Math.round(p.meters / (p.taka_length || 100)),
    pct: Math.min(100, (received / p.meters) * 100),
    shortfall,
    shortfall_pct: shortfall != null ? r2((shortfall / p.meters) * 100) : null,
  }
}

export const listPOs = async () => (await all(`${PO_SQL} ORDER BY p.id DESC`)).map(decoratePo)
export async function getPO(id) {
  const p = await one(`${PO_SQL} WHERE p.id=?`, [id])
  if (!p) return null
  return { ...decoratePo(p), receipts: await listReceipts('WHERE r.po_id=?', [id]) }
}
export async function createPO(d) {
  const po_no = String(d.po_no || '').trim()
  if (!po_no) bad('PO number is required (copy it from the paper PO)')
  if (!d.group_id) bad('Choose a party group')
  if (!d.quality_id) bad('Choose a quality')
  const meters = Number(d.meters), rate = Number(d.rate)
  if (!(meters > 0)) bad('Ordered meters must be greater than 0')
  if (!(rate > 0)) bad('Rate must be greater than 0')
  const taka_length = Number(d.taka_length) || 100
  return tx(async (q) => {
    if (await q.one('SELECT id FROM grey_pos WHERE LOWER(TRIM(po_no))=?', [po_no.toLowerCase()])) bad(`PO number ${po_no} already exists`)
    if (!(await q.one('SELECT id FROM weaver_groups WHERE id=?', [d.group_id]))) bad('Party group not found')
    if (!(await q.one('SELECT id FROM qualities WHERE id=?', [d.quality_id]))) bad('Quality not found')
    const { lastId } = await q.run(
      `INSERT INTO grey_pos (po_no,po_date,group_id,quality_id,meters,rate,taka_length,due_date,notes,image_url) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [po_no, d.po_date || null, d.group_id, d.quality_id, meters, rate, taka_length, d.due_date || null, d.notes || null, d.image_url || null],
    )
    return lastId
  })
}
/** Closing short freezes further receipts (decision D-4); re-opening is always possible. */
export const setPOClosed = (id, closed) => run('UPDATE grey_pos SET closed=? WHERE id=?', [closed ? 1 : 0, id])

/**
 * Edit a PO. Number/date/rate/meters/notes can always change. The party group, quality and taka length are fixed once
 * a challan has been received against the PO (they are baked into those takas). Meters cannot drop below what was received
 * unless the PO is then closed short — so just keep ordered ≥ received, or close it.
 */
export async function updatePO(id, d) {
  const po_no = String(d.po_no || '').trim()
  if (!po_no) bad('PO number is required (copy it from the paper PO)')
  if (!d.group_id) bad('Choose a party group')
  if (!d.quality_id) bad('Choose a quality')
  const meters = Number(d.meters), rate = Number(d.rate)
  if (!(meters > 0)) bad('Ordered meters must be greater than 0')
  if (!(rate > 0)) bad('Rate must be greater than 0')
  const taka_length = Number(d.taka_length) || 100
  return tx(async (q) => {
    const p = await q.one('SELECT * FROM grey_pos WHERE id=?', [id])
    if (!p) bad('PO not found')
    if (await q.one('SELECT id FROM grey_pos WHERE LOWER(TRIM(po_no))=? AND id<>?', [po_no.toLowerCase(), id])) bad(`PO number ${po_no} already exists`)
    const rc = Number((await q.one('SELECT COUNT(*) AS c FROM grey_receipts WHERE po_id=?', [id])).c)
    if (rc > 0 && (Number(d.group_id) !== Number(p.group_id) || Number(d.quality_id) !== Number(p.quality_id))) bad('Party group and quality cannot change after grey was received against this PO')
    if (rc === 0) {
      if (!(await q.one('SELECT id FROM weaver_groups WHERE id=?', [d.group_id]))) bad('Party group not found')
      if (!(await q.one('SELECT id FROM qualities WHERE id=?', [d.quality_id]))) bad('Quality not found')
    }
    await q.run(
      'UPDATE grey_pos SET po_no=?, po_date=?, group_id=?, quality_id=?, meters=?, rate=?, taka_length=?, due_date=?, notes=?, image_url=? WHERE id=?',
      [po_no, d.po_date || null, d.group_id, d.quality_id, meters, rate, taka_length, d.due_date || null, d.notes || null, d.image_url || null, id],
    )
    return id
  })
}


// ---------------------------------------------------------------- grey receipts
const RC_SQL = `SELECT r.*, p.po_no, p.quality_id, p.taka_length, q.nick_name, q.original_name, w.name AS weaver_name, g.name AS group_name, m.name AS mill_name, br.name AS branch_name,
  (SELECT COUNT(*) FROM takas t WHERE t.receipt_id=r.id) AS taka_count,
  (SELECT ROUND(COALESCE(SUM(grey_meter),0),2) FROM takas t WHERE t.receipt_id=r.id) AS total_m,
  (SELECT COUNT(*) FROM takas t WHERE t.receipt_id=r.id AND t.status='GODOWN_GREY') AS godown_count,
  (SELECT COUNT(*) FROM takas t WHERE t.receipt_id=r.id AND t.status='GODOWN_GREY' AND t.location_id IS NULL) AS unassigned_count
  FROM grey_receipts r JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id
  JOIN weavers w ON w.id=r.weaver_id JOIN weaver_groups g ON g.id=w.group_id LEFT JOIN mills m ON m.id=r.mill_id LEFT JOIN branches br ON br.id=r.branch_id`

export const listReceipts = (where = '', args = []) => all(`${RC_SQL} ${where} ORDER BY r.date DESC, r.id DESC`, args)
export async function getReceipt(id) {
  const r = await one(`${RC_SQL} WHERE r.id=?`, [id])
  if (!r) return null
  return { ...r, takas: await listTakas('WHERE t.receipt_id=?', [id]) }
}

/** d: {po_id, weaver_id, challan_no, date, destination:'GODOWN'|'MILL', mill_id, location_id, image_url, notes, takas:[{taka_no, meter}]} */
export async function createReceipt(d) {
  if (!d.takas?.length) bad('Add at least one taka')
  const toMill = d.destination === 'MILL'
  if (!toMill && d.destination !== 'GODOWN') bad('Destination must be our godown or a mill')
  const challan = String(d.challan_no || '').trim()
  if (!challan) bad('Challan number is required')
  if (!d.date) bad('Receipt date is required')
  // validate rows (no DB needed)
  const seen = new Set()
  const rows = d.takas.map((t, i) => {
    const no = String(t.taka_no ?? '').trim()
    if (!no) bad(`Row ${i + 1}: taka number is required`)
    if (seen.has(no.toLowerCase())) bad(`Duplicate taka number ${no} in this challan`)
    seen.add(no.toLowerCase())
    return { taka_no: no, meter: meters2(t.meter, `Taka ${no}`) }
  })
  return tx(async (q) => {
    const po = await q.one('SELECT id, closed FROM grey_pos WHERE id=?', [d.po_id])
    if (!po) bad('Choose a purchase order')
    if (po.closed) bad('This PO is closed (short). Re-open it to receive more.')
    const w = await q.one(`SELECT w.id, g.id AS group_id FROM weavers w JOIN weaver_groups g ON g.id=w.group_id JOIN grey_pos p ON p.group_id=g.id WHERE w.id=? AND p.id=?`, [d.weaver_id, d.po_id])
    if (!w) bad("The party must belong to the PO's party group")
    if (toMill && !(await q.one('SELECT id FROM mills WHERE id=?', [d.mill_id]))) bad('Choose the mill this challan was delivered to')
    const branchId = !toMill && d.branch_id ? Number(d.branch_id) : null
    if (!toMill && !branchId) bad('Choose the branch where this grey is received')
    if (branchId && !(await q.one('SELECT id FROM branches WHERE id=?', [branchId]))) bad('Branch not found')
    const locId = !toMill && d.location_id ? Number(d.location_id) : null
    if (locId) {
      const loc = await q.one('SELECT id, branch_id FROM locations WHERE id=?', [locId])
      if (!loc) bad('That rack does not exist')
      if (loc.branch_id && Number(loc.branch_id) !== branchId) bad('That rack belongs to a different branch')
    }
    const { lastId } = await q.run(
      `INSERT INTO grey_receipts (po_id,weaver_id,challan_no,date,destination,mill_id,image_url,notes,branch_id) VALUES (?,?,?,?,?,?,?,?,?)`,
      [d.po_id, d.weaver_id, challan, d.date, d.destination, toMill ? d.mill_id : null, d.image_url || null, d.notes || null, branchId],
    )
    const status = toMill ? 'MILL_GREY' : 'GODOWN_GREY'
    const first = await q.one('SELECT COALESCE(MAX(id),0) AS m FROM takas')
    for (const part of chunks(rows, 100)) {
      await q.run(
        `INSERT INTO takas (receipt_id,taka_no,grey_meter,status,location_id,mill_id,branch_id) VALUES ${part.map(() => '(?,?,?,?,?,?,?)').join(',')}`,
        part.flatMap((t) => [lastId, t.taka_no, t.meter, status, locId, toMill ? d.mill_id : null, branchId]),
      )
    }
    const created = await q.all('SELECT id FROM takas WHERE receipt_id=? AND id>? ORDER BY id', [lastId, first.m])
    await insertMoves(q, created.map((t) => ({ taka_id: t.id, from_status: null, to_status: status, to_location_id: locId, mill_id: toMill ? d.mill_id : null, ref_type: 'RECEIPT', ref_id: lastId, note: toMill ? 'RECEIVED DIRECT AT MILL' : 'RECEIVED' })))
    return lastId
  })
}

/**
 * Edit a grey challan. Challan no, date, party, notes and photo can always change. The branch/rack and the taka list
 * (numbers, meters, add/remove) can change only while every taka is still untouched — i.e. still in the godown with no
 * dispatch, or (direct receipts) still grey at the mill with no program. d.takas: [{id?, taka_no, meter}].
 */
export async function updateReceipt(id, d) {
  const challan = String(d.challan_no || '').trim()
  if (!challan) bad('Challan number is required')
  if (!d.date) bad('Receipt date is required')
  return tx(async (q) => {
    const r = await q.one('SELECT * FROM grey_receipts WHERE id=?', [id])
    if (!r) bad('Challan not found')
    const toMill = r.destination === 'MILL'
    const w = await q.one(`SELECT w.id FROM weavers w JOIN grey_pos p ON p.group_id=w.group_id WHERE w.id=? AND p.id=?`, [d.weaver_id, r.po_id])
    if (!w) bad("The party must belong to the PO's party group")
    const takas = await q.all('SELECT * FROM takas WHERE receipt_id=?', [id])
    const untouched = takas.every((t) => t.status === (toMill ? 'MILL_GREY' : 'GODOWN_GREY') && !t.dispatch_id && !t.program_line_id)
    await q.run('UPDATE grey_receipts SET challan_no=?, date=?, weaver_id=?, notes=?, image_url=? WHERE id=?', [challan, d.date, d.weaver_id, d.notes || null, d.image_url || null, id])

    // branch / rack
    let branchId = r.branch_id
    if (!toMill && d.branch_id && Number(d.branch_id) !== Number(r.branch_id)) {
      if (!untouched) bad('The branch cannot change once some takas were sent to a mill')
      if (!(await q.one('SELECT id FROM branches WHERE id=?', [d.branch_id]))) bad('Branch not found')
      branchId = Number(d.branch_id)
      await q.run('UPDATE grey_receipts SET branch_id=? WHERE id=?', [branchId, id])
      // racks belong to a branch: takas moved to another branch lose their rack
      await q.run('UPDATE takas SET branch_id=?, location_id=NULL WHERE receipt_id=?', [branchId, id])
    }

    if (d.takas) {
      const seen = new Set()
      const rows = d.takas.map((t, i) => {
        const no = String(t.taka_no ?? '').trim()
        if (!no) bad(`Row ${i + 1}: taka number is required`)
        if (seen.has(no.toLowerCase())) bad(`Duplicate taka number ${no} in this challan`)
        seen.add(no.toLowerCase())
        return { id: t.id ? Number(t.id) : null, taka_no: no, meter: meters2(t.meter, `Taka ${no}`) }
      })
      if (!rows.length) bad('A challan needs at least one taka')
      const byId = new Map(takas.map((t) => [t.id, t]))
      const changed = rows.some((n) => !n.id || Number(byId.get(n.id)?.grey_meter) !== n.meter || String(byId.get(n.id)?.taka_no) !== n.taka_no) || takas.some((t) => !rows.some((n) => n.id === t.id))
      if (changed) {
        if (!untouched) bad('Takas can only be edited while all of them are still untouched (not sent to a mill / put in a program)')
        for (const t of takas) {
          if (!rows.some((n) => n.id === t.id)) {
            await q.run('DELETE FROM taka_moves WHERE taka_id=?', [t.id])
            await q.run('DELETE FROM takas WHERE id=?', [t.id])
          }
        }
        const status = toMill ? 'MILL_GREY' : 'GODOWN_GREY'
        const added = []
        for (const n of rows) {
          if (n.id && byId.has(n.id)) await q.run('UPDATE takas SET taka_no=?, grey_meter=? WHERE id=?', [n.taka_no, n.meter, n.id])
          else {
            const { lastId } = await q.run('INSERT INTO takas (receipt_id,taka_no,grey_meter,status,location_id,mill_id,branch_id) VALUES (?,?,?,?,?,?,?)', [id, n.taka_no, n.meter, status, null, toMill ? r.mill_id : null, branchId])
            added.push(lastId)
          }
        }
        if (added.length) await insertMoves(q, added.map((taka_id) => ({ taka_id, from_status: null, to_status: status, mill_id: toMill ? r.mill_id : null, ref_type: 'RECEIPT', ref_id: id, note: 'ADDED BY EDIT' })))
      }
    }
    return id
  })
}

// ---------------------------------------------------------------- mill dispatch (our mill challan)
const DS_SQL = `SELECT d.*, m.name AS mill_name,
  (SELECT COUNT(*) FROM takas t WHERE t.dispatch_id=d.id) AS taka_count,
  (SELECT ROUND(COALESCE(SUM(grey_meter),0),2) FROM takas t WHERE t.dispatch_id=d.id) AS total_m,
  (SELECT GROUP_CONCAT(DISTINCT q.nick_name) FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id WHERE t.dispatch_id=d.id) AS qualities
  FROM mill_dispatches d JOIN mills m ON m.id=d.mill_id`
export const listDispatches = () => all(`${DS_SQL} ORDER BY d.id DESC`)
export async function getDispatch(id) {
  const d = await one(`${DS_SQL} WHERE d.id=?`, [id])
  if (!d) return null
  return { ...d, takas: await listTakas('WHERE t.dispatch_id=?', [id]) }
}
/** Picking list for a sent challan: where each taka was taken from (rack at the time of sending). */
export async function getPickList(dispatchId) {
  const [takas, moves, locs] = await Promise.all([
    listTakas('WHERE t.dispatch_id=?', [dispatchId]),
    all(`SELECT taka_id, from_location_id FROM taka_moves WHERE ref_type='DISPATCH' AND ref_id=?`, [dispatchId]),
    listLocations(),
  ])
  const from = new Map(moves.map((m) => [m.taka_id, m.from_location_id]))
  const locById = new Map(locs.map((l) => [l.id, l]))
  return groupPickList(takas, (t) => {
    const id = from.has(t.id) ? from.get(t.id) : t.location_id
    const l = locById.get(id)
    return { id: id ?? null, shop: l?.shop, rack: l?.rack, branch: l?.branch_name }
  })
}
export async function createDispatch({ mill_id, date, notes, taka_ids }) {
  if (!taka_ids?.length) bad('Select takas to send')
  if (!mill_id) bad('Choose a mill')
  if (!date) bad('Date is required')
  return tx(async (q) => {
    if (!(await q.one('SELECT id FROM mills WHERE id=?', [mill_id]))) bad('Mill not found')
    const rows = await requireTakas(q, taka_ids, 'GODOWN_GREY', 'send to mill')
    const no = await nextNo('mill_dispatches', 'DC', q)
    const { lastId } = await q.run('INSERT INTO mill_dispatches (dispatch_no,date,mill_id,notes) VALUES (?,?,?,?)', [no, date, mill_id, notes || null])
    await updateTakas(q, rows.map((t) => t.id), `status='MILL_GREY', mill_id=?, dispatch_id=?, location_id=NULL`, [mill_id, lastId], 'GODOWN_GREY')
    await insertMoves(q, rows.map((t) => ({ taka_id: t.id, from_status: 'GODOWN_GREY', to_status: 'MILL_GREY', from_location_id: t.location_id, mill_id, ref_type: 'DISPATCH', ref_id: lastId, note: 'SENT TO MILL' })))
    return lastId
  })
}

// ---------------------------------------------------------------- dyeing programs
const PG_SQL = `SELECT pr.*, m.name AS mill_name, q.nick_name, q.original_name, c.name AS chart_name,
  (SELECT COALESCE(SUM(taka_count),0) FROM program_lines WHERE program_id=pr.id) AS total_takas,
  (SELECT COUNT(*) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE pl.program_id=pr.id AND t.finished_receipt_id IS NOT NULL) AS received_takas,
  (SELECT ROUND(COALESCE(SUM(t.grey_meter),0),2) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE pl.program_id=pr.id) AS grey_m
  FROM programs pr JOIN mills m ON m.id=pr.mill_id JOIN qualities q ON q.id=pr.quality_id JOIN shade_charts c ON c.id=pr.chart_id`
const LINES_SQL = `SELECT pl.*, s.number AS shade_no, s.name AS shade_name, s.hex, it.code AS item_code,
  (SELECT COUNT(*) FROM takas t WHERE t.program_line_id=pl.id) AS allocated,
  (SELECT COUNT(*) FROM takas t WHERE t.program_line_id=pl.id AND t.finished_receipt_id IS NOT NULL) AS received,
  (SELECT ROUND(COALESCE(SUM(t.grey_meter),0),2) FROM takas t WHERE t.program_line_id=pl.id) AS grey_m,
  (SELECT ROUND(COALESCE(SUM(t.finished_meter),0),2) FROM takas t WHERE t.program_line_id=pl.id AND t.finished_receipt_id IS NOT NULL) AS finished_m
  FROM program_lines pl JOIN shades s ON s.id=pl.shade_id LEFT JOIN items it ON it.id=pl.item_id`
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
const MILL_GREY_WHERE = `WHERE t.status='MILL_GREY' AND t.mill_id=? AND p.quality_id=?`
export const millGreyTakas = (millId, qualityId, q = base) => listTakas(MILL_GREY_WHERE, [millId, qualityId], q)

/** Takas of a program are taken first-in-first-out from "grey at that mill" of the chosen quality. */
export async function createProgram({ mill_id, quality_id, chart_id, date, notes, lines, total_takas }) {
  if (!mill_id || !quality_id || !chart_id) bad('Choose mill, quality and shade chart')
  if (!date) bad('Date is required')
  const valid = (lines || []).filter((l) => (l.item_id || l.shade_id) && Number(l.taka_count) > 0)
  if (!valid.length) bad('Add at least one item line')
  const seen = new Set()
  for (const l of valid) {
    if (!Number.isInteger(Number(l.taka_count))) bad('Taka counts must be whole numbers')
    const key = String(l.item_id ? 'i' + l.item_id : 's' + l.shade_id)
    if (seen.has(key)) bad('Each item can appear only once in a program')
    seen.add(key)
  }
  const need = valid.reduce((s, l) => s + Number(l.taka_count), 0)
  if (total_takas != null && total_takas !== '' && Number(total_takas) !== need) bad(`Shade split adds up to ${need} takas but the program is for ${Number(total_takas)}`)
  return tx(async (q) => {
    // an item (unique code = quality + colour) decides the shade of its line
    for (const l of valid) {
      if (!l.item_id) continue
      const it = await q.one('SELECT id, code, quality_id, shade_id FROM items WHERE id=?', [l.item_id])
      if (!it) bad('Item not found')
      if (Number(it.quality_id) !== Number(quality_id)) bad(`Item ${it.code} is not of the chosen quality`)
      if (!it.shade_id) bad(`Item ${it.code} has no colour/shade — set one in the item master`)
      l.shade_id = it.shade_id
    }
    const avail = await millGreyTakas(mill_id, quality_id, q)
    if (need > avail.length) bad(`Only ${avail.length} grey takas of this quality are available at this mill (you asked for ${need})`)
    const okShades = await q.all(`SELECT id FROM shades WHERE chart_id=? AND id IN (${qs(valid)})`, [chart_id, ...valid.map((l) => l.shade_id)])
    if (okShades.length !== valid.length) bad('Every shade must belong to the chosen shade chart')
    const no = await nextNo('programs', 'PG', q)
    const { lastId } = await q.run('INSERT INTO programs (program_no,date,mill_id,quality_id,chart_id,notes) VALUES (?,?,?,?,?,?)', [no, date, mill_id, quality_id, chart_id, notes || null])
    let cursor = 0
    for (const l of valid) {
      const { lastId: lineId } = await q.run('INSERT INTO program_lines (program_id,shade_id,taka_count,item_id) VALUES (?,?,?,?)', [lastId, l.shade_id, Number(l.taka_count), l.item_id || null])
      const picked = avail.slice(cursor, cursor + Number(l.taka_count))
      cursor += picked.length
      await updateTakas(q, picked.map((t) => t.id), `status='IN_DYEING', program_line_id=?`, [lineId], 'MILL_GREY')
      await insertMoves(q, picked.map((t) => ({ taka_id: t.id, from_status: 'MILL_GREY', to_status: 'IN_DYEING', mill_id, ref_type: 'PROGRAM', ref_id: lastId, note: 'PROGRAM' })))
    }
    return lastId
  })
}

// ---------------------------------------------------------------- finished receipts (mill challan back to us)
const FR_SQL = `SELECT fr.*, pr.program_no, pr.mill_id, m.name AS mill_name, q.nick_name,
  (SELECT COUNT(*) FROM takas t WHERE t.finished_receipt_id=fr.id) AS taka_count,
  (SELECT ROUND(COALESCE(SUM(COALESCE(mill_grey_meter, grey_meter)),0),2) FROM takas t WHERE t.finished_receipt_id=fr.id) AS grey_m,
  (SELECT ROUND(COALESCE(SUM(finished_meter),0),2) FROM takas t WHERE t.finished_receipt_id=fr.id) AS finished_m
  FROM finished_receipts fr JOIN programs pr ON pr.id=fr.program_id JOIN mills m ON m.id=pr.mill_id JOIN qualities q ON q.id=pr.quality_id`
export const listFinishedReceipts = (where = '', args = []) => all(`${FR_SQL} ${where} ORDER BY fr.id DESC`, args)

/** rows: [{id, mill_grey_meter, finished_meter}] — partial returns allowed; each taka can be received once. */
export async function createFinishedReceipt({ program_id, challan_no, date, image_url, notes, rows }) {
  if (!rows?.length) bad('Select received takas')
  if (!String(challan_no || '').trim()) bad('Mill challan number is required')
  if (!date) bad('Date is required')
  const clean = rows.map((r) => ({
    id: Number(r.id),
    grey: meters2(r.mill_grey_meter, 'Mill grey meter'),
    fin: meters2(r.finished_meter, 'Finished meter'),
  }))
  return tx(async (q) => {
    const prog = await q.one('SELECT id FROM programs WHERE id=?', [program_id])
    if (!prog) bad('Program not found')
    const found = await requireTakas(q, clean.map((r) => r.id), 'IN_DYEING', 'receive')
    const lines = await q.all('SELECT id FROM program_lines WHERE program_id=?', [program_id])
    const lineIds = new Set(lines.map((l) => l.id))
    if (found.some((t) => !lineIds.has(t.program_line_id))) bad('Some takas do not belong to this program')
    const { lastId } = await q.run('INSERT INTO finished_receipts (program_id,challan_no,date,image_url,notes) VALUES (?,?,?,?,?)', [program_id, String(challan_no).trim(), date, image_url || null, notes || null])
    for (const r of clean) {
      const res = await q.run(`UPDATE takas SET status='FINISHED', finished_receipt_id=?, mill_grey_meter=?, finished_meter=? WHERE id=? AND status='IN_DYEING'`, [lastId, r.grey, r.fin, r.id])
      if (res.changes !== 1) bad('A taka changed while saving — nothing was saved')
    }
    await insertMoves(q, clean.map((r) => ({ taka_id: r.id, from_status: 'IN_DYEING', to_status: 'FINISHED', ref_type: 'MILL_RECEIPT', ref_id: lastId, note: 'FINISHED RECEIVED' })))
    return lastId
  })
}

// ---------------------------------------------------------------- folding
export async function foldTakas(rows, date = today()) {
  if (!rows?.length) bad('Select takas to fold')
  const clean = rows.map((r) => ({ id: Number(r.id), m: meters2(r.folded_meter, 'Folded meter') }))
  return tx(async (q) => {
    await requireTakas(q, clean.map((r) => r.id), 'FINISHED', 'fold')
    for (const r of clean) {
      const res = await q.run(`UPDATE takas SET status='FOLDED', folded_meter=?, folded_on=? WHERE id=? AND status='FINISHED'`, [r.m, date, r.id])
      if (res.changes !== 1) bad('A taka changed while saving — nothing was saved')
    }
    await insertMoves(q, clean.map((r) => ({ taka_id: r.id, from_status: 'FINISHED', to_status: 'FOLDED', ref_type: 'FOLDING', note: 'FOLDED' })))
    return clean.length
  })
}

// ---------------------------------------------------------------- customer orders
// An order line asks for a colour (via its item code) in TAKAS, in METERS, or both — orders often arrive in meters.
const OR_SQL = `SELECT o.*, c.name AS customer_name, c.city AS customer_city, q.nick_name, q.original_name,
  (SELECT COALESCE(SUM(taka_count),0) FROM order_lines WHERE order_id=o.id) AS total_takas,
  (SELECT ROUND(COALESCE(SUM(meters),0),2) FROM order_lines WHERE order_id=o.id) AS total_meters,
  (SELECT COUNT(*) FROM takas t WHERE t.order_id=o.id) AS allocated,
  (SELECT ROUND(COALESCE(SUM(t.folded_meter),0),2) FROM takas t WHERE t.order_id=o.id) AS allocated_m
  FROM orders o JOIN customers c ON c.id=o.customer_id JOIN qualities q ON q.id=o.quality_id`
const OL_SQL = `SELECT ol.*, s.number AS shade_no, s.name AS shade_name, s.hex, it.code AS item_code,
  (SELECT COUNT(*) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE t.order_id=ol.order_id AND pl.shade_id=ol.shade_id) AS allocated,
  (SELECT ROUND(COALESCE(SUM(t.folded_meter),0),2) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE t.order_id=ol.order_id AND pl.shade_id=ol.shade_id) AS allocated_m
  FROM order_lines ol JOIN shades s ON s.id=ol.shade_id LEFT JOIN items it ON it.id=ol.item_id`
/** A line is fulfilled when every unit it asks for (takas and/or meters) is covered. */
export const orderLineDone = (l) =>
  (Number(l.taka_count) > 0 || Number(l.meters) > 0) &&
  (!(Number(l.taka_count) > 0) || Number(l.allocated) >= Number(l.taka_count)) &&
  (!(Number(l.meters) > 0) || Number(l.allocated_m) >= Number(l.meters))
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

/** Validates + normalises order lines. Each line: {item_id?|shade_id, taka_count?, meters?}. Resolves the shade from the item. */
async function cleanOrderLines(q, quality_id, lines) {
  const valid = (lines || []).filter((l) => (l.item_id || l.shade_id) && (Number(l.taka_count) > 0 || Number(l.meters) > 0))
  if (!valid.length) bad('Add at least one line with takas or meters')
  const out = []
  for (const l of valid) {
    const taka_count = l.taka_count === '' || l.taka_count == null ? 0 : Number(l.taka_count)
    if (!Number.isInteger(taka_count) || taka_count < 0) bad('Taka counts must be whole numbers')
    const meters = l.meters === '' || l.meters == null || Number(l.meters) === 0 ? null : meters2(l.meters, 'Order meters')
    if (!taka_count && !meters) bad('Each line needs takas or meters')
    let shade_id = l.shade_id, item_id = l.item_id || null
    if (item_id) {
      const it = await q.one('SELECT id, code, quality_id, shade_id FROM items WHERE id=?', [item_id])
      if (!it) bad('Item not found')
      if (Number(it.quality_id) !== Number(quality_id)) bad(`Item ${it.code} is not of the order's quality`)
      if (!it.shade_id) bad(`Item ${it.code} has no colour/shade — set one in the item master`)
      shade_id = it.shade_id
    }
    out.push({ item_id, shade_id, taka_count, meters })
  }
  if (new Set(out.map((l) => String(l.shade_id))).size !== out.length) bad('Each item/colour can appear only once in an order')
  return out
}
const insertOrderLines = async (q, orderId, lines) => {
  for (const l of lines) await q.run('INSERT INTO order_lines (order_id,shade_id,taka_count,item_id,meters) VALUES (?,?,?,?,?)', [orderId, l.shade_id, l.taka_count, l.item_id, l.meters])
}

export async function createOrder({ order_no, date, customer_id, quality_id, notes, lines }) {
  const no = String(order_no || '').trim()
  if (!no) bad('Order number is required')
  if (!customer_id || !quality_id) bad('Choose customer and quality')
  return tx(async (q) => {
    const clean = await cleanOrderLines(q, quality_id, lines)
    if (await q.one('SELECT id FROM orders WHERE LOWER(order_no)=?', [no.toLowerCase()])) bad(`Order number ${no} already exists`)
    const { lastId } = await q.run('INSERT INTO orders (order_no,date,customer_id,quality_id,notes) VALUES (?,?,?,?,?)', [no, date || today(), customer_id, quality_id, notes || null])
    await insertOrderLines(q, lastId, clean)
    return lastId
  })
}

/**
 * Edit an order. Header fields (number, date, customer, notes) can always change; the quality and the lines only
 * while nothing has been allocated to the order yet.
 */
export async function updateOrder(id, { order_no, date, customer_id, quality_id, notes, lines }) {
  const no = String(order_no || '').trim()
  if (!no) bad('Order number is required')
  if (!customer_id || !quality_id) bad('Choose customer and quality')
  return tx(async (q) => {
    const o = await q.one('SELECT * FROM orders WHERE id=?', [id])
    if (!o) bad('Order not found')
    if (await q.one('SELECT id FROM orders WHERE LOWER(order_no)=? AND id<>?', [no.toLowerCase(), id])) bad(`Order number ${no} already exists`)
    if (!(await q.one('SELECT id FROM customers WHERE id=?', [customer_id]))) bad('Customer not found')
    const allocated = Number((await q.one('SELECT COUNT(*) AS c FROM takas WHERE order_id=?', [id])).c)
    if (allocated > 0) {
      if (Number(quality_id) !== Number(o.quality_id)) bad('Quality cannot change after stock was allocated to this order')
      await q.run('UPDATE orders SET order_no=?, date=?, customer_id=?, notes=? WHERE id=?', [no, date || o.date, customer_id, notes || null, id])
      return id
    }
    const clean = await cleanOrderLines(q, quality_id, lines)
    await q.run('UPDATE orders SET order_no=?, date=?, customer_id=?, quality_id=?, notes=?, status=? WHERE id=?', [no, date || o.date, customer_id, quality_id, notes || null, 'OPEN', id])
    await q.run('DELETE FROM order_lines WHERE order_id=?', [id])
    await insertOrderLines(q, id, clean)
    return id
  })
}

/**
 * Allocates READY (folded) takas FIFO to each line → SOLD. A line in takas takes that many takas; a line in meters
 * takes whole takas until the folded meters reach the ordered meters (the last taka may overshoot — takas are not cut).
 * NOTE: this booking rule came from the generated app; the brief asks to treat booking/reservation as an
 * open question (docs/SPEC.md Q6). Availability checking (below) does not depend on it.
 */
export async function allocateOrder(id) {
  return tx(async (q) => {
    const o = await q.one('SELECT * FROM orders WHERE id=?', [id])
    if (!o) bad('Order not found')
    const lines = await q.all(`${OL_SQL} WHERE ol.order_id=? ORDER BY ol.id`, [id])
    let allocated = 0, short = 0
    for (const l of lines) {
      const needTakas = Math.max(0, Number(l.taka_count) - Number(l.allocated))
      const needM = l.meters ? Math.max(0, r2(Number(l.meters) - Number(l.allocated_m))) : 0
      if (needTakas <= 0 && needM <= 0) continue
      const ready = await listTakas(`WHERE t.status='FOLDED' AND p.quality_id=? AND pl.shade_id=?`, [o.quality_id, l.shade_id], q)
      const ids = []
      let gotM = 0
      for (const t of ready) {
        if (ids.length >= needTakas && gotM >= needM) break
        ids.push(t.id); gotM = r2(gotM + Number(t.folded_meter))
      }
      if (ids.length) {
        await updateTakas(q, ids, `status='SOLD', order_id=?`, [id], 'FOLDED')
        await insertMoves(q, ids.map((taka_id) => ({ taka_id, from_status: 'FOLDED', to_status: 'SOLD', ref_type: 'ORDER', ref_id: id, note: 'ALLOCATED TO ORDER' })))
      }
      allocated += ids.length
      if (ids.length < needTakas || gotM < needM) short += 1
    }
    if (short === 0) await q.run(`UPDATE orders SET status='DONE' WHERE id=?`, [id])
    return { allocated, short }
  })
}

export async function closeOrder(id) {
  return await run(`UPDATE orders SET status='DONE' WHERE id=?`, [id])
}

// ---------------------------------------------------------------- stock views (audit §2.10)
const acc = () => ({ takas: 0, m: 0 })
const add = (a, m) => { a.takas += 1; a.m = r2(a.m + Number(m || 0)) }

export const INVENTORY_VIEWS = {
  godown: { label: 'Grey at our place', statuses: ['GODOWN_GREY'], meter: (t) => t.grey_meter },
  mill: { label: 'Grey at mill', statuses: ['MILL_GREY'], meter: (t) => t.grey_meter },
  dyeing: { label: 'In dyeing', statuses: ['IN_DYEING'], meter: (t) => t.mill_grey_meter ?? t.grey_meter },
  finished: { label: 'Finished goods', statuses: ['FINISHED', 'FOLDED'], meter: (t) => t.folded_meter ?? t.finished_meter },
}

/** Counts/meters for the four views + reconciliation against all active (not SOLD) takas. */
export async function inventoryCounts() {
  const rows = await all(`SELECT status, COUNT(*) AS c, ROUND(COALESCE(SUM(CASE status
      WHEN 'FOLDED' THEN folded_meter WHEN 'FINISHED' THEN finished_meter WHEN 'IN_DYEING' THEN COALESCE(mill_grey_meter, grey_meter) ELSE grey_meter END),0),2) AS m
    FROM takas GROUP BY status`)
  const by = Object.fromEntries(rows.map((r) => [r.status, { takas: Number(r.c), m: r2(r.m) }]))
  const views = {}
  const known = new Set(['SOLD'])
  for (const [k, v] of Object.entries(INVENTORY_VIEWS)) {
    views[k] = v.statuses.reduce((a, s) => { known.add(s); return { takas: a.takas + (by[s]?.takas || 0), m: r2(a.m + (by[s]?.m || 0)) } }, { takas: 0, m: 0 })
  }
  const active = rows.filter((r) => r.status !== 'SOLD').reduce((s, r) => s + Number(r.c), 0)
  const other = rows.filter((r) => !known.has(r.status)).reduce((s, r) => s + Number(r.c), 0)
  const sum = Object.values(views).reduce((s, v) => s + v.takas, 0)
  return { views, active, sold: by.SOLD?.takas || 0, other, sum, reconciled: sum === active && other === 0 }
}

/** Grey in our godowns, branch by branch: [{id,name,takas,m,unassigned}]. */
export async function godownByBranch() {
  const rows = await all(`SELECT t.branch_id AS id, COALESCE(b.name, 'No branch') AS name, COUNT(*) AS c, ROUND(COALESCE(SUM(t.grey_meter),0),2) AS m,
    SUM(CASE WHEN t.location_id IS NULL THEN 1 ELSE 0 END) AS unassigned
    FROM takas t LEFT JOIN branches b ON b.id=t.branch_id WHERE t.status='GODOWN_GREY' GROUP BY t.branch_id, b.name ORDER BY b.name`)
  return rows.map((r) => ({ id: r.id, name: r.name, takas: Number(r.c), m: r2(r.m), unassigned: Number(r.unassigned) }))
}

// ---------------------------------------------------------------- settings + dead stock
export const DEFAULT_DEAD_STOCK_DAYS = 30

export async function getSetting(key, fallback = null) {
  const r = await one('SELECT value FROM settings WHERE key=?', [key])
  return r ? r.value : fallback
}
export async function setSetting(key, value) {
  await run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, String(value)])
}
/** After how many days without any movement finished goods count as dead stock (user setting). */
export async function getDeadStockDays() {
  const v = Number(await getSetting('dead_stock_days'))
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : DEFAULT_DEAD_STOCK_DAYS
}
export async function setDeadStockDays(days) {
  const n = Number(days)
  if (!Number.isInteger(n) || n < 1 || n > 3650) bad('Enter a whole number of days between 1 and 3650')
  await setSetting('dead_stock_days', n)
  return n
}

/**
 * Dead stock = finished goods (finished or folded, not sold) that have not been touched for `days` days.
 * "Touched" = the last recorded movement of the taka (received, folded, …); older takas fall back to their folded / receipt date.
 * Returns the takas (same shape as inventoryList) with last_at and idle_days. `nowMs` is injectable for tests.
 */
export async function deadStock(days, f = {}, nowMs = Date.now()) {
  const [takas, last] = await Promise.all([
    inventoryList('finished', f),
    all('SELECT taka_id, MAX(at) AS last_at FROM taka_moves GROUP BY taka_id'),
  ])
  const lastById = new Map(last.map((r) => [r.taka_id, r.last_at]))
  return takas
    .map((t) => {
      const at = lastById.get(t.id) || (t.folded_on ? `${t.folded_on}T00:00:00.000Z` : null) || (t.receipt_date ? `${t.receipt_date}T00:00:00.000Z` : null)
      const idle = at ? Math.floor((nowMs - new Date(at).getTime()) / 864e5) : null
      return { ...t, last_at: at, idle_days: idle }
    })
    .filter((t) => t.idle_days != null && t.idle_days >= days)
}

/** Takas of one view. filters: quality_id, group_id, weaver_id, mill_id, shade_id, location_id */
export async function inventoryList(view, f = {}) {
  const v = INVENTORY_VIEWS[view]
  if (!v) bad('Unknown stock view')
  const where = [`t.status IN (${qs(v.statuses)})`], args = [...v.statuses]
  const add1 = (cond, val) => { if (val !== undefined && val !== null && val !== '') { where.push(cond); args.push(val) } }
  add1('p.quality_id=?', f.quality_id); add1('g.id=?', f.group_id); add1('r.weaver_id=?', f.weaver_id)
  add1('t.mill_id=?', f.mill_id); add1('t.branch_id=?', f.branch_id); add1('pl.shade_id=?', f.shade_id); add1('t.location_id=?', f.location_id)
  const takas = await listTakas(`WHERE ${where.join(' AND ')}`, args)
  return takas.map((t) => ({ ...t, stock_m: Number(v.meter(t) ?? 0) }))
}

/**
 * Availability for a customer order (R-SO-1): for one quality (by nickname) and each requested shade.
 * Grey stock has no shade yet, so it is reported once for the quality.
 */
export async function availabilityDetail(qualityId, shadeIds = []) {
  const [takas, shades] = await Promise.all([
    listTakas(`WHERE p.quality_id=? AND t.status!='SOLD'`, [qualityId]),
    all(`SELECT s.*, c.name AS chart_name FROM shades s JOIN shade_charts c ON c.id=s.chart_id ${shadeIds.length ? `WHERE s.id IN (${qs(shadeIds)})` : 'WHERE 0'}`, shadeIds),
  ])
  const group = (arr, keyOf, labelOf) => {
    const m = new Map()
    for (const [t, mt] of arr) { const k = keyOf(t); if (!m.has(k)) m.set(k, { label: labelOf(t), ...acc() }); add(m.get(k), mt) }
    return [...m.values()]
  }
  const mill = takas.filter((t) => t.status === 'MILL_GREY')
  const place = takas.filter((t) => t.status === 'GODOWN_GREY')
  const out = {
    greyAtMill: { ...acc(), byMill: group(mill.map((t) => [t, t.grey_meter]), (t) => t.mill_id, (t) => t.mill_name || '—') },
    greyAtPlace: { ...acc(), byLocation: group(place.map((t) => [t, t.grey_meter]), (t) => `${t.branch_id ?? ''}|${t.location_id ?? 'none'}`, (t) => (t.location_id ? locLabel(t.shop, t.rack, t.branch_name) : `${t.branch_name ? t.branch_name + ' / ' : ''}No rack assigned`)), byBranch: group(place.map((t) => [t, t.grey_meter]), (t) => t.branch_id ?? 'none', (t) => t.branch_name || 'No branch') },
    shades: [],
  }
  mill.forEach((t) => add(out.greyAtMill, t.grey_meter))
  place.forEach((t) => add(out.greyAtPlace, t.grey_meter))
  for (const sd of shades) {
    const mine = takas.filter((t) => t.shade_id === sd.id)
    const fin = mine.filter((t) => t.status === 'FINISHED' || t.status === 'FOLDED')
    const dye = mine.filter((t) => t.status === 'IN_DYEING')
    const s = { shade_id: sd.id, shade_no: sd.number, shade_name: sd.name, hex: sd.hex, chart_name: sd.chart_name, finished: acc(), folded: acc(), unfolded: acc(), dyeing: acc(), programs: [] }
    fin.forEach((t) => { const m = t.folded_meter ?? t.finished_meter; add(s.finished, m); add(t.status === 'FOLDED' ? s.folded : s.unfolded, m) })
    dye.forEach((t) => add(s.dyeing, t.mill_grey_meter ?? t.grey_meter))
    s.programs = group(dye.map((t) => [t, t.grey_meter]), (t) => t.program_id, (t) => `${t.program_no} · ${t.program_mill_name}`)
    out.shades.push(s)
  }
  return out
}

/** Older, compact stock position kept for compatibility. */
export async function availability(qualityId) {
  const takas = await listTakas(`WHERE p.quality_id=? AND t.status!='SOLD'`, [qualityId])
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

// ---------------------------------------------------------------- shrinkage report (R-SH-1..3)
function summarize(rows, keyOf, labelOf, extra = () => ({})) {
  const m = new Map()
  for (const t of rows) {
    const k = keyOf(t)
    if (!m.has(k)) m.set(k, { key: k, label: labelOf(t), takas: 0, start: 0, finished: 0, folded: 0, foldedTakas: 0, finishLoss: 0, foldLoss: 0, totalLoss: 0, ...extra(t) })
    const g = m.get(k)
    g.takas += 1
    g.start += t.start
    g.finished += t.finished_meter != null ? Number(t.finished_meter) : 0
    g.finishLoss += t.finishLoss ?? 0
    g.totalLoss += t.totalLoss ?? 0
    if (t.folded_meter != null) { g.folded += Number(t.folded_meter); g.foldedTakas += 1; g.foldLoss += t.foldLoss ?? 0 }
  }
  return [...m.values()].map((g) => ({
    ...g,
    start: r2(g.start), finished: r2(g.finished), folded: r2(g.folded), finishLoss: r2(g.finishLoss), foldLoss: r2(g.foldLoss), totalLoss: r2(g.totalLoss),
    finishPct: g.start ? r2((g.finishLoss / g.start) * 100) : null,
    totalPct: g.start ? r2((g.totalLoss / g.start) * 100) : null,
  }))
}

/** Per-taka chains for every taka that came back from the mill, plus summaries by PO/party/quality/mill/program. */
export async function shrinkageReport() {
  const [takas, pos] = await Promise.all([listTakas('WHERE t.finished_meter IS NOT NULL'), listPOs()])
  const poById = new Map(pos.map((p) => [p.id, p]))
  const byPo = summarize(takas, (t) => t.po_id, (t) => t.po_no).map((g) => ({ ...g, po: poById.get(g.key) }))
  for (const p of pos) if (!byPo.some((g) => g.key === p.id) && p.received_m > 0) byPo.push({ key: p.id, label: p.po_no, takas: 0, start: 0, finished: 0, folded: 0, finishLoss: 0, foldLoss: 0, totalLoss: 0, finishPct: null, totalPct: null, po: p })
  return {
    rows: takas,
    byPo,
    byParty: summarize(takas, (t) => t.weaver_id, (t) => `${t.weaver_name} (${t.group_name})`),
    byQuality: summarize(takas, (t) => t.quality_id, (t) => t.nick_name),
    byMill: summarize(takas, (t) => t.program_mill_id, (t) => t.program_mill_name || t.mill_name || '—'),
    byProgram: summarize(takas, (t) => t.program_id, (t) => t.program_no),
  }
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
  const openPos = pos.filter((p) => p.status === 'OPEN' || p.status === 'PARTIAL')
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
/** Demo data is written ONLY into a completely empty local database (never a remote one unless explicitly allowed). */
let seeding
export function ensureSeed() {
  // memoised: React StrictMode mounts twice, and two concurrent seeds would insert the demo data twice
  return (seeding ||= seedIfEmpty())
}
async function seedIfEmpty() {
  if (mode === 'local') {
    // Repair: an older build seeded twice (StrictMode), leaving every PO/quality duplicated in the browser's saved DB.
    // Duplicate PO numbers or quality nicknames can only come from that bug, so wipe and seed one clean copy.
    const dup = await one(`SELECT (SELECT COUNT(*) FROM (SELECT po_no FROM grey_pos GROUP BY po_no HAVING COUNT(*) > 1)) +
      (SELECT COUNT(*) FROM (SELECT nick_name FROM qualities GROUP BY nick_name HAVING COUNT(*) > 1)) AS c`)
    if (Number(dup?.c) > 0) { await resetDemo(); return }
  }
  if (mode !== 'local' && import.meta.env?.VITE_ALLOW_DEMO_SEED !== 'true') return
  for (const t of ['qualities', 'weaver_groups', 'mills', 'customers', 'locations', 'shade_charts', 'grey_pos', 'grey_receipts', 'takas', 'orders']) {
    const r = await one(`SELECT COUNT(*) AS c FROM ${t}`)
    if (Number(r.c) > 0) return
  }
  const { seed } = await import('./seed')
  await seed()
}
export async function resetDemo() {
  await dropAll() // throws in remote mode
  const { seed } = await import('./seed')
  await seed()
}
export async function clearAll() {
  await dropAll()
}
