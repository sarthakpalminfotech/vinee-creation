// All domain data access. Pages must only use these functions (see specs/02-architecture.md).
import { all, one, run, tx, dropAll, mode } from './client'

export const STATUS_META = {
  GODOWN_GREY: { label: 'Grey · Godown', cls: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  MILL_GREY: { label: 'Grey · Mill', cls: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  IN_DYEING: { label: 'In Dyeing', cls: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  FINISHED: { label: 'Finished', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  FOLDED: { label: 'Ready', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  SOLD: { label: 'Sold', cls: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400' },
  JOB_WORK: { label: 'At job worker', cls: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  NOT_RETURNED: { label: 'Not returned', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  WITHDRAWN: { label: 'Withdrawn', cls: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400' },
  GREY_SOLD: { label: 'Grey sold', cls: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400' },
}
export const PIPELINE = ['GODOWN_GREY', 'MILL_GREY', 'IN_DYEING', 'FINISHED', 'FOLDED', 'JOB_WORK', 'SOLD']
/** Statuses that are no longer stock. EVERY "active stock" query must exclude exactly these. */
export const INACTIVE_STATUSES = ['SOLD', 'GREY_SOLD', 'WITHDRAWN', 'NOT_RETURNED']
const NOT_INACTIVE = (col = 't.status') => `${col} NOT IN (${INACTIVE_STATUSES.map((x) => `'${x}'`).join(',')})`
/** The taka state machine: from → allowed next statuses. WITHDRAWN → <previous status> is decided per taka (withdrawal_takas.prev_status). */
export const TRANSITIONS = {
  GODOWN_GREY: ['MILL_GREY', 'WITHDRAWN', 'GREY_SOLD'],
  MILL_GREY: ['IN_DYEING'],
  IN_DYEING: ['FINISHED'],
  FINISHED: ['FOLDED'],
  FOLDED: ['SOLD', 'JOB_WORK', 'WITHDRAWN'],
  JOB_WORK: ['FOLDED', 'NOT_RETURNED'],
  NOT_RETURNED: ['JOB_WORK'],
  WITHDRAWN: ['GODOWN_GREY', 'FOLDED'],
  SOLD: [],
  GREY_SOLD: [],
}
export const canMove = (from, to) => (TRANSITIONS[from] || []).includes(to)
function assertMove(from, to) { if (!canMove(from, to)) bad(`A taka cannot go from "${STATUS_META[from]?.label || from}" to "${STATUS_META[to]?.label || to}"`) }

export const today = () => new Date().toISOString().slice(0, 10)
const r2 = (n) => Math.round(Number(n) * 100) / 100
const qs = (arr) => arr.map(() => '?').join(',')
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
const base = { all, one, run }
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
const bad = (msg) => { throw new Error(msg) }
const nowIso = () => new Date().toISOString()
/** Rows per multi-row statement. Keeps a 500-taka save within ~20 statements (and far below SQLite's variable limit). */
const ROWS = 150
/** `CASE id WHEN ? THEN ? … END` for a multi-row UPDATE: {sql, args} with 2 args per row. */
const caseWhen = (rows, valueOf) => ({ sql: `CASE id ${rows.map(() => 'WHEN ? THEN ?').join(' ')} END`, args: rows.flatMap((r) => [r.id, valueOf(r)]) })
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
  weaver_groups: ['name', 'contact', 'phone', 'city', 'gstin'],
  weavers: ['group_id', 'name', 'gstin', 'phone'],
  mills: ['name', 'contact', 'phone', 'city', 'gstin'],
  customers: ['name', 'contact', 'phone', 'city', 'gstin'],
  qualities: ['original_name', 'nick_name', 'taka_length', 'notes'],
  job_workers: ['name', 'phone', 'city', 'gstin', 'notes'],
  branches: ['name', 'city', 'address', 'phone'],
  locations: ['branch_id', 'shop', 'rack'],
  items: ['code', 'quality_id', 'shade_id', 'notes'],
  shade_charts: ['name'],
  message_templates: ['name', 'body'],
}
// Racks (locations), items and shade charts are retired from the screens (colours belong to qualities, no rack picking);
// their tables and rules stay so old data keeps working.
const USAGE = {
  weaver_groups: [['weavers', 'group_id'], ['grey_pos', 'group_id']],
  weavers: [['grey_receipts', 'weaver_id'], ['grey_sales', 'weaver_id']],
  mills: [['grey_receipts', 'mill_id'], ['mill_dispatches', 'mill_id'], ['mill_challan_mains', 'mill_id'], ['programs', 'mill_id'], ['takas', 'mill_id']],
  customers: [['orders', 'customer_id'], ['grey_sales', 'customer_id']],
  job_workers: [['job_work_challans', 'job_worker_id']],
  qualities: [['grey_pos', 'quality_id'], ['programs', 'quality_id'], ['orders', 'quality_id']],
  branches: [['locations', 'branch_id'], ['grey_receipts', 'branch_id'], ['takas', 'branch_id']],
  items: [['program_lines', 'item_id'], ['order_lines', 'item_id']],
  locations: [['takas', 'location_id'], ['taka_moves', 'from_location_id'], ['taka_moves', 'to_location_id']],
  shade_charts: [['shades', 'chart_id'], ['programs', 'chart_id']],
  shades: [['program_lines', 'shade_id'], ['order_lines', 'shade_id'], ['quality_shades', 'shade_id']],
}

const REQUIRED = {
  weaver_groups: ['name'], weavers: ['group_id', 'name'], mills: ['name'], customers: ['name'],
  qualities: ['original_name', 'nick_name', 'taka_length'], job_workers: ['name'], branches: ['name'], locations: ['branch_id', 'shop', 'rack'], items: ['code', 'quality_id'],
  shade_charts: ['name'], message_templates: ['name', 'body'],
}
const UNIQUE = {
  weaver_groups: ['name'], weavers: ['group_id', 'name'], mills: ['name'], customers: ['name'],
  qualities: ['nick_name'], job_workers: ['name'], branches: ['name'], locations: ['branch_id', 'shop', 'rack'], items: ['code'], shade_charts: ['name'], message_templates: ['name'],
}

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
/** Trimmed + upper-case, or null when empty. */
export const normGstin = (v) => { const t = String(v ?? '').trim().toUpperCase(); return t || null }
/** GSTIN is optional: empty is fine, and a filled value that does not look right only produces a warning in the UI (it still saves). */
export const gstinLooksValid = (v) => !normGstin(v) || GSTIN_RE.test(normGstin(v))

const HEX_RE = /^#[0-9a-fA-F]{6}$/
/** The hidden chart every colour / program points to (shade_charts is gone from the UI but chart_id stays NOT NULL). */
async function libraryChartId(q = base) {
  const row = await q.one("SELECT id FROM shade_charts WHERE name='__library__' ORDER BY id LIMIT 1")
  if (row) return Number(row.id)
  const { lastId } = await q.run("INSERT INTO shade_charts (name) VALUES ('__library__')")
  return lastId
}

/** WhatsApp message templates (Masters → Message templates), by name. */
export async function listMessageTemplates() {
  return all('SELECT * FROM message_templates ORDER BY name COLLATE NOCASE')
}

export async function saveMaster(table, obj) {
  if (table === 'shades') return saveShade(obj)
  const cols = MASTER_COLS[table]
  const clean = {}
  for (const c of cols) {
    const v = typeof obj[c] === 'string' ? obj[c].trim() : obj[c]
    clean[c] = v === '' ? null : v
  }
  for (const c of REQUIRED[table] || []) if (clean[c] === null || clean[c] === undefined) bad(`${c === 'group_id' ? 'Firm' : c.replace(/_/g, ' ')} is required`)
  if (table === 'qualities') { clean.taka_length = Number(clean.taka_length); if (!(clean.taka_length > 0)) bad('Taka length must be greater than 0') }
  if (cols.includes('gstin')) clean.gstin = normGstin(clean.gstin)
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

/** What a table is called in messages (weaver_groups are "firms", weavers their "associated parties"). */
const TABLE_LABEL = {
  weavers: 'associated parties', grey_pos: 'POs', grey_receipts: 'weaver challans', grey_sales: 'grey sales', mill_dispatches: 'mill sub-challans',
  mill_challan_mains: 'mill challans', job_work_challans: 'job work challans', quality_shades: 'quality colours',
}
export async function removeMaster(table, id) {
  for (const [t, col] of USAGE[table] || []) {
    const r = await one(`SELECT COUNT(*) AS c FROM ${t} WHERE ${col}=?`, [id])
    if (Number(r.c) > 0) throw new Error(`Cannot delete — it is used in ${r.c} ${TABLE_LABEL[t] || t.replace(/_/g, ' ')}.`)
  }
  if (table === 'qualities') {
    // a quality that was never used: its colour links and private colours go with it
    await tx(async (q) => {
      await q.run('DELETE FROM shades WHERE quality_id=?', [id])
      await q.run('DELETE FROM quality_shades WHERE quality_id=?', [id])
      await q.run('DELETE FROM qualities WHERE id=?', [id])
    })
    return
  }
  await run(`DELETE FROM ${table} WHERE id=?`, [id])
}

// ---- colours: a common library (shades with quality_id NULL) + colours linked to qualities (quality_shades) ----
/**
 * Create / update a colour. obj: {id?, number (= the shade name), name (= description), hex?, image_url?, quality_id? (private colour)}.
 * Library colours are unique by name within the library; private ones by name within their quality. A hex or an image is required.
 */
export async function saveShade(obj) {
  const str = (v) => { const t = typeof v === 'string' ? v.trim() : v; return t === '' || t === undefined ? null : t }
  const number = str(obj.number), name = str(obj.name), hex = str(obj.hex), image_url = str(obj.image_url)
  if (!number) bad('Shade name is required')
  if (!hex && !image_url) bad('Pick a colour or add an image')
  if (hex && !HEX_RE.test(hex)) bad('Colour must be a hex value like #A1B2C3')
  return tx(async (q) => {
    let owner = obj.quality_id ? Number(obj.quality_id) : null
    if (obj.id) {
      const cur = await q.one('SELECT id, quality_id FROM shades WHERE id=?', [obj.id])
      if (!cur) bad('Colour not found')
      owner = cur.quality_id ? Number(cur.quality_id) : null
    }
    if (owner && !(await q.one('SELECT id FROM qualities WHERE id=?', [owner]))) bad('Quality not found')
    const dup = await q.one(
      `SELECT id FROM shades WHERE LOWER(TRIM(number))=? AND ${owner ? 'quality_id=?' : 'quality_id IS NULL'} AND id<>?`,
      owner ? [number.toLowerCase(), owner, obj.id || 0] : [number.toLowerCase(), obj.id || 0],
    )
    if (dup) bad(`A colour named "${number}" already exists${owner ? ' for this quality' : ' in the library'}`)
    if (obj.id) {
      await q.run('UPDATE shades SET number=?, name=?, hex=?, image_url=? WHERE id=?', [number, name, hex, image_url, obj.id])
      return Number(obj.id)
    }
    const chart = await libraryChartId(q)
    const { lastId } = await q.run('INSERT INTO shades (chart_id,number,name,hex,image_url,quality_id,active) VALUES (?,?,?,?,?,?,1)', [chart, number, name, hex, image_url, owner])
    if (owner) await q.run('INSERT INTO quality_shades (quality_id,shade_id,active,added_at) VALUES (?,?,1,?)', [owner, lastId, nowIso()])
    return lastId
  })
}
/** Library-level switch: an inactive library colour cannot be added to qualities. */
export const setShadeActive = (id, active) => run('UPDATE shades SET active=? WHERE id=?', [active ? 1 : 0, id])

/** The common colour library (private colours of one quality are never listed), with how many qualities use each. */
export const listShades = () =>
  all(`SELECT s.*, (SELECT COUNT(*) FROM quality_shades qs WHERE qs.shade_id=s.id) AS used_by
    FROM shades s WHERE s.quality_id IS NULL ORDER BY LOWER(s.number)`)

const QC_SQL = `SELECT qs.id AS link_id, qs.quality_id, qs.active AS link_active, qs.added_at,
  s.id AS shade_id, s.number, s.name, s.hex, s.image_url, s.quality_id AS owner_quality_id, COALESCE(s.active,1) AS shade_active,
  CASE WHEN COALESCE(qs.active,1)=1 AND COALESCE(s.active,1)=1 THEN 1 ELSE 0 END AS active,
  (SELECT MAX(pr.date) FROM programs pr JOIN program_lines pl ON pl.program_id=pr.id WHERE COALESCE(pl.quality_id,pr.quality_id)=qs.quality_id AND pl.shade_id=qs.shade_id) AS last_program,
  (SELECT MAX(o.date) FROM orders o JOIN order_lines ol ON ol.order_id=o.id WHERE o.quality_id=qs.quality_id AND ol.shade_id=qs.shade_id) AS last_order,
  (SELECT COUNT(*) FROM programs pr JOIN program_lines pl ON pl.program_id=pr.id WHERE COALESCE(pl.quality_id,pr.quality_id)=qs.quality_id AND pl.shade_id=qs.shade_id)
  + (SELECT COUNT(*) FROM orders o JOIN order_lines ol ON ol.order_id=o.id WHERE o.quality_id=qs.quality_id AND ol.shade_id=qs.shade_id) AS used_count
  FROM quality_shades qs JOIN shades s ON s.id=qs.shade_id`
const decorateQc = (r) => ({ ...r, active: Number(r.active) === 1, private: r.owner_quality_id != null, used: Number(r.used_count) > 0 })
/** Colours of one quality — active first, inactive greyed at the end — each with its last program / order date. */
export async function listQualityColours(qualityId) {
  const rows = (await all(`${QC_SQL} WHERE qs.quality_id=? ORDER BY LOWER(s.number)`, [qualityId])).map(decorateQc)
  return [...rows.filter((r) => r.active), ...rows.filter((r) => !r.active)]
}
/** Colour counts per quality: {quality_id: {total, active}}. */
export async function qualityColourCounts() {
  const rows = await all(`SELECT qs.quality_id, COUNT(*) AS total, SUM(CASE WHEN COALESCE(qs.active,1)=1 AND COALESCE(s.active,1)=1 THEN 1 ELSE 0 END) AS active
    FROM quality_shades qs JOIN shades s ON s.id=qs.shade_id GROUP BY qs.quality_id`)
  return Object.fromEntries(rows.map((r) => [r.quality_id, { total: Number(r.total), active: Number(r.active) }]))
}
/** Link library colours to a quality (already linked ones are skipped). Returns how many were added. */
export async function addQualityColours(qualityId, shadeIds) {
  const ids = [...new Set((shadeIds || []).map(Number))]
  if (!ids.length) bad('Select at least one colour')
  return tx(async (q) => {
    if (!(await q.one('SELECT id FROM qualities WHERE id=?', [qualityId]))) bad('Quality not found')
    const found = await q.all(`SELECT id, quality_id, COALESCE(active,1) AS active FROM shades WHERE id IN (${qs(ids)})`, ids)
    if (found.length !== ids.length) bad('Some colours no longer exist')
    if (found.some((s) => s.quality_id != null)) bad('Only colours from the common library can be added')
    if (found.some((s) => Number(s.active) !== 1)) bad('Inactive library colours cannot be added')
    const have = new Set((await q.all(`SELECT shade_id FROM quality_shades WHERE quality_id=? AND shade_id IN (${qs(ids)})`, [qualityId, ...ids])).map((r) => Number(r.shade_id)))
    const add = ids.filter((id) => !have.has(id))
    const at = nowIso()
    for (const part of chunks(add, ROWS)) {
      await q.run(`INSERT INTO quality_shades (quality_id,shade_id,active,added_at) VALUES ${part.map(() => '(?,?,1,?)').join(',')}`, part.flatMap((id) => [qualityId, id, at]))
    }
    return add.length
  })
}
/** A colour that belongs to this quality only (never shown in the library). */
export const addOwnColour = (qualityId, { number, name, hex, image_url }) => {
  if (!qualityId) bad('Choose a quality')
  return saveShade({ number, name, hex, image_url, quality_id: qualityId })
}
export async function setQualityColourActive(qualityId, shadeId, active) {
  const r = await run('UPDATE quality_shades SET active=? WHERE quality_id=? AND shade_id=?', [active ? 1 : 0, qualityId, shadeId])
  if (!r.changes) bad('This colour is not linked to the quality')
}
/** Unlink a colour from a quality — only if that quality never used it in a program or an order (otherwise make it inactive). */
export async function removeQualityColour(qualityId, shadeId) {
  return tx(async (q) => {
    const link = await q.one('SELECT id FROM quality_shades WHERE quality_id=? AND shade_id=?', [qualityId, shadeId])
    if (!link) bad('This colour is not linked to the quality')
    const used = Number((await q.one(`SELECT (SELECT COUNT(*) FROM programs pr JOIN program_lines pl ON pl.program_id=pr.id WHERE COALESCE(pl.quality_id,pr.quality_id)=? AND pl.shade_id=?)
      + (SELECT COUNT(*) FROM orders o JOIN order_lines ol ON ol.order_id=o.id WHERE o.quality_id=? AND ol.shade_id=?) AS c`, [qualityId, shadeId, qualityId, shadeId])).c)
    if (used > 0) bad('This colour was already used by this quality — make it inactive instead of removing it')
    await q.run('DELETE FROM quality_shades WHERE id=?', [link.id])
    await q.run('DELETE FROM shades WHERE id=? AND quality_id=?', [shadeId, qualityId]) // a private colour goes with its only link
  })
}
/** Every colour must be linked AND active for the quality. `keep` = colours already on the document (always allowed). */
async function requireQualityColours(q, qualityId, shadeIds, what, keep = new Set()) {
  const ids = [...new Set(shadeIds.map(Number))]
  if (!ids.length) return
  const rows = await q.all(`SELECT qs.shade_id, COALESCE(qs.active,1) AS la, COALESCE(s.active,1) AS sa, s.number FROM quality_shades qs JOIN shades s ON s.id=qs.shade_id WHERE qs.quality_id=? AND qs.shade_id IN (${qs(ids)})`, [qualityId, ...ids])
  const by = new Map(rows.map((r) => [Number(r.shade_id), r]))
  for (const id of ids) {
    const r = by.get(id)
    if (!r) bad(`A colour of this ${what} is not available for its quality — add it to the quality first`)
    if ((Number(r.la) !== 1 || Number(r.sa) !== 1) && !keep.has(id)) bad(`Colour "${r.number}" is inactive for this quality`)
  }
}

export const listMills = () => all('SELECT * FROM mills ORDER BY name')
export const listCustomers = () => all('SELECT * FROM customers ORDER BY name')
export const listJobWorkers = () => all('SELECT * FROM job_workers ORDER BY name')
export const listQualities = () => all('SELECT * FROM qualities ORDER BY nick_name')
export const listBranches = () => all('SELECT * FROM branches ORDER BY name')
export const listLocations = () =>
  all('SELECT l.*, b.name AS branch_name FROM locations l LEFT JOIN branches b ON b.id=l.branch_id ORDER BY b.name, l.shop, l.rack')
// Item master: retired (no item codes any more — colours belong to qualities). Kept only so old data stays readable.
export const listItems = () =>
  all(`SELECT i.*, q.nick_name, q.original_name, s.number AS shade_no, s.name AS shade_name, s.hex, s.chart_id, c.name AS chart_name
    FROM items i JOIN qualities q ON q.id=i.quality_id LEFT JOIN shades s ON s.id=i.shade_id LEFT JOIN shade_charts c ON c.id=s.chart_id
    ORDER BY q.nick_name, c.name, CAST(s.number AS REAL), s.number`)
/** Retired with the item master (unused by the UI). */
export function suggestItemCode(nick, shadeNo) {
  const words = String(nick || '').trim().split(/\s+/).filter(Boolean)
  const ini = (words.length > 1 ? words.map((w) => w[0]).join('') : words[0]?.slice(0, 3) || 'IT').toUpperCase()
  return shadeNo ? `${ini}-${String(shadeNo).toUpperCase().replace(/\s+/g, '')}` : ini
}
/** Retired with the item master (unused by the UI): creates an item for every shade of a chart that has none yet. */
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
/** Old shade charts (retired from the UI; the hidden __library__ chart is not listed). */
export const listCharts = () => all("SELECT * FROM shade_charts WHERE name<>'__library__' ORDER BY name")
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
export const nextProgramNo = () => nextNo('programs', 'PG')

// ---------------------------------------------------------------- takas
const TAKA_SQL = `SELECT t.*, r.challan_no, r.date AS receipt_date, r.destination, r.po_id, r.weaver_id,
  w.name AS weaver_name, g.id AS group_id, g.name AS group_name,
  p.po_no, p.quality_id, p.taka_length, q.nick_name, q.original_name,
  l.shop, l.rack, b.name AS branch_name, m.name AS mill_name, d.dispatch_no, d.main_id, d.suffix AS dispatch_suffix, mm.main_no,
  pl.program_id, pl.shade_id, pl.lot_no AS line_lot_no, pr.program_no, pr.mill_id AS program_mill_id, pm.name AS program_mill_name,
  s.number AS shade_no, s.hex AS shade_hex, s.name AS shade_name, s.image_url AS shade_image,
  fr.challan_no AS finished_challan, fr.date AS finished_date, o.order_no,
  jwc.jw_no, jwc.date AS jw_date, jwc.job_type AS jw_challan_type, jwk.name AS jw_worker_name,
  (SELECT ROUND(SUM(j.sent_m - j.received_m),2) FROM job_work_takas j WHERE j.taka_id=t.id AND j.status='RECEIVED') AS jw_short_m,
  dm.id AS damage_id, dm.meters AS damage_m, dm.image_url AS damage_image, dm.voice_url AS damage_voice, dm.voice_local AS damage_voice_local, dm.notes AS damage_notes, dm.at AS damage_at,
  CASE WHEN t.folded_meter IS NOT NULL THEN ROUND(COALESCE(t.jw_return_meter, t.folded_meter - COALESCE(dm.meters,0)),2) END AS sellable_m
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
  LEFT JOIN mill_challan_mains mm ON mm.id=d.main_id
  LEFT JOIN program_lines pl ON pl.id=t.program_line_id
  LEFT JOIN programs pr ON pr.id=pl.program_id
  LEFT JOIN mills pm ON pm.id=pr.mill_id
  LEFT JOIN shades s ON s.id=pl.shade_id
  LEFT JOIN finished_receipts fr ON fr.id=t.finished_receipt_id
  LEFT JOIN orders o ON o.id=t.order_id
  LEFT JOIN taka_damages dm ON dm.taka_id=t.id
  LEFT JOIN job_work_challans jwc ON jwc.id=t.jw_challan_id
  LEFT JOIN job_workers jwk ON jwk.id=jwc.job_worker_id`

/**
 * Per-taka shortage chain (client change 5): grey (weaver challan) → finished (mill return challan) → folded.
 * The same for godown takas and direct-to-mill takas; nothing is measured between the weaver and the mill.
 *   millShortage = grey − finished · foldShortage = finished − folded · totalShortage = grey − (folded ?? finished)
 * Percentages are always against the grey meter. `damage` (taka_damages) is separate from the folding shortage.
 */
export function withLineage(t) {
  const direct = t.destination === 'MILL'
  const grey = Number(t.grey_meter)
  const finished = num(t.finished_meter)
  const folded = num(t.folded_meter)
  const millShortage = finished != null ? r2(grey - finished) : null
  const foldShortage = folded != null && finished != null ? r2(finished - folded) : null
  const end = folded ?? finished
  const totalShortage = end != null ? r2(grey - end) : null
  const pct = (v) => (v != null && grey ? r2((v / grey) * 100) : null)
  return {
    ...t, direct, grey, start: grey, end, millShortage, foldShortage, totalShortage,
    millPct: pct(millShortage), foldPct: pct(foldShortage), totalPct: pct(totalShortage),
    damage: t.damage_m != null ? Number(t.damage_m) : null,
    jwShortage: t.jw_short_m != null ? Number(t.jw_short_m) : null,
    jobWorked: t.jw_type != null,
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
  for (const part of chunks(list, ROWS)) {
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
      `SELECT t.id, t.status, t.location_id, t.branch_id, t.mill_id, t.program_line_id, t.taka_no, t.receipt_id, t.grey_meter, r.challan_no FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id WHERE t.id IN (${qs(part)})`, part)))
  }
  if (found.length !== uniq.length) bad('Some selected takas no longer exist')
  const wrong = found.filter((t) => t.status !== status)
  if (wrong.length) {
    const sample = wrong.slice(0, 5).map((t) => `${t.challan_no}/${t.taka_no} (${STATUS_META[t.status]?.label || t.status})`).join(', ')
    bad(`Cannot ${action}: ${wrong.length} taka(s) are not "${STATUS_META[status].label}" — ${sample}${wrong.length > 5 ? '…' : ''}`)
  }
  return found
}

const SAVE_RACE = 'Some takas changed while saving — nothing was saved, please reload and try again'
async function updateTakas(q, ids, setSql, setArgs, whereStatus) {
  let changed = 0
  for (const part of chunks(ids, 400)) {
    const r = await q.run(`UPDATE takas SET ${setSql} WHERE id IN (${qs(part)}) AND status=?`, [...setArgs, ...part, whereStatus])
    changed += r.changes
  }
  if (changed !== ids.length) bad(SAVE_RACE)
}
/** Same, but some columns get a different value per taka (`CASE id WHEN … END`), ROWS takas per statement. */
async function updateTakasEach(q, rows, fixedSql, fixedArgs, perRow, whereStatus) {
  let changed = 0
  for (const part of chunks(rows, ROWS)) {
    const sets = fixedSql ? [fixedSql] : [], args = fixedSql ? [...fixedArgs] : []
    for (const [col, valueOf] of Object.entries(perRow)) {
      const c = caseWhen(part, valueOf)
      sets.push(`${col}=${c.sql}`); args.push(...c.args)
    }
    const r = await q.run(`UPDATE takas SET ${sets.join(', ')} WHERE id IN (${qs(part)}) AND status=?`, [...args, ...part.map((x) => x.id), whereStatus])
    changed += r.changes
  }
  if (changed !== rows.length) bad(SAVE_RACE)
}

// Rack assignment is retired from the screens (client change 4a); the function, history and pick list stay for old data and are unused.
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

/** Retired with racks (unused by the UI): group takas by their rack → [{key,label,shop,rack,takas,count,meters}]. */
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
const PO_SQL = `SELECT p.*, g.name AS group_name, g.gstin AS group_gstin, q.nick_name, q.original_name,
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

/** Status per audit brief R-PO-2. shortfall = ordered − received ("Short received" on the screens), shown once received/closed. */
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
  if (!d.group_id) bad('Choose a firm')
  if (!d.quality_id) bad('Choose a quality')
  const meters = Number(d.meters), rate = Number(d.rate)
  if (!(meters > 0)) bad('Ordered meters must be greater than 0')
  if (!(rate > 0)) bad('Rate must be greater than 0')
  const taka_length = Number(d.taka_length) || 100
  return tx(async (q) => {
    if (await q.one('SELECT id FROM grey_pos WHERE LOWER(TRIM(po_no))=?', [po_no.toLowerCase()])) bad(`PO number ${po_no} already exists`)
    if (!(await q.one('SELECT id FROM weaver_groups WHERE id=?', [d.group_id]))) bad('Firm not found')
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
  if (!d.group_id) bad('Choose a firm')
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
    if (rc > 0 && (Number(d.group_id) !== Number(p.group_id) || Number(d.quality_id) !== Number(p.quality_id))) bad('Firm and quality cannot change after grey was received against this PO')
    if (rc === 0) {
      if (!(await q.one('SELECT id FROM weaver_groups WHERE id=?', [d.group_id]))) bad('Firm not found')
      if (!(await q.one('SELECT id FROM qualities WHERE id=?', [d.quality_id]))) bad('Quality not found')
    }
    await q.run(
      'UPDATE grey_pos SET po_no=?, po_date=?, group_id=?, quality_id=?, meters=?, rate=?, taka_length=?, due_date=?, notes=?, image_url=? WHERE id=?',
      [po_no, d.po_date || null, d.group_id, d.quality_id, meters, rate, taka_length, d.due_date || null, d.notes || null, d.image_url || null, id],
    )
    return id
  })
}


// ---------------------------------------------------------------- grey receipts (weaver challans)
const RC_SQL = `SELECT r.*, p.po_no, p.quality_id, p.taka_length, q.nick_name, q.original_name, w.name AS weaver_name, g.name AS group_name, m.name AS mill_name, br.name AS branch_name,
  (SELECT COUNT(*) FROM takas t WHERE t.receipt_id=r.id) AS taka_count,
  (SELECT ROUND(COALESCE(SUM(grey_meter),0),2) FROM takas t WHERE t.receipt_id=r.id) AS total_m,
  (SELECT COUNT(*) FROM takas t WHERE t.receipt_id=r.id AND t.status='GODOWN_GREY') AS godown_count
  FROM grey_receipts r JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id
  JOIN weavers w ON w.id=r.weaver_id JOIN weaver_groups g ON g.id=w.group_id LEFT JOIN mills m ON m.id=r.mill_id LEFT JOIN branches br ON br.id=r.branch_id`

export const listReceipts = (where = '', args = []) => all(`${RC_SQL} ${where} ORDER BY r.date DESC, r.id DESC`, args)
export async function getReceipt(id) {
  const r = await one(`${RC_SQL} WHERE r.id=?`, [id])
  if (!r) return null
  return { ...r, takas: await listTakas('WHERE t.receipt_id=?', [id]) }
}

/** d: {po_id, weaver_id, challan_no, date, destination:'GODOWN'|'MILL', mill_id, branch_id, image_url, notes, takas:[{taka_no, meter}]}. location_id is ignored (no racks). */
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
    if (!w) bad("The associated party must belong to the PO's firm")
    if (toMill && !(await q.one('SELECT id FROM mills WHERE id=?', [d.mill_id]))) bad('Choose the mill this challan was delivered to')
    const branchId = !toMill && d.branch_id ? Number(d.branch_id) : null
    if (!toMill && !branchId) bad('Choose the branch where this grey is received')
    if (branchId && !(await q.one('SELECT id FROM branches WHERE id=?', [branchId]))) bad('Branch not found')
    const { lastId } = await q.run(
      `INSERT INTO grey_receipts (po_id,weaver_id,challan_no,date,destination,mill_id,image_url,notes,branch_id) VALUES (?,?,?,?,?,?,?,?,?)`,
      [d.po_id, d.weaver_id, challan, d.date, d.destination, toMill ? d.mill_id : null, d.image_url || null, d.notes || null, branchId],
    )
    const status = toMill ? 'MILL_GREY' : 'GODOWN_GREY'
    const first = await q.one('SELECT COALESCE(MAX(id),0) AS m FROM takas')
    for (const part of chunks(rows, ROWS)) {
      await q.run(
        `INSERT INTO takas (receipt_id,taka_no,grey_meter,status,location_id,mill_id,branch_id) VALUES ${part.map(() => '(?,?,?,?,?,?,?)').join(',')}`,
        part.flatMap((t) => [lastId, t.taka_no, t.meter, status, null, toMill ? d.mill_id : null, branchId]),
      )
    }
    const created = await q.all('SELECT id FROM takas WHERE receipt_id=? AND id>? ORDER BY id', [lastId, first.m])
    await insertMoves(q, created.map((t) => ({ taka_id: t.id, from_status: null, to_status: status, mill_id: toMill ? d.mill_id : null, ref_type: 'RECEIPT', ref_id: lastId, note: toMill ? 'RECEIVED DIRECT AT MILL' : 'RECEIVED' })))
    return lastId
  })
}

/**
 * Edit a grey challan. Challan no, date, party, notes and photo can always change. The branch and the taka list
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
    if (!w) bad("The associated party must belong to the PO's firm")
    const takas = await q.all('SELECT * FROM takas WHERE receipt_id=?', [id])
    const untouched = takas.every((t) => t.status === (toMill ? 'MILL_GREY' : 'GODOWN_GREY') && !t.dispatch_id && !t.program_line_id)
    await q.run('UPDATE grey_receipts SET challan_no=?, date=?, weaver_id=?, notes=?, image_url=? WHERE id=?', [challan, d.date, d.weaver_id, d.notes || null, d.image_url || null, id])

    // branch
    let branchId = r.branch_id
    if (!toMill && d.branch_id && Number(d.branch_id) !== Number(r.branch_id)) {
      if (!untouched) bad('The branch cannot change once some takas were sent to a mill')
      if (!(await q.one('SELECT id FROM branches WHERE id=?', [d.branch_id]))) bad('Branch not found')
      branchId = Number(d.branch_id)
      await q.run('UPDATE grey_receipts SET branch_id=? WHERE id=?', [branchId, id])
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
        const keep = new Set(rows.filter((n) => n.id && byId.has(n.id)).map((n) => n.id))
        const removed = takas.filter((t) => !keep.has(t.id)).map((t) => t.id)
        for (const part of chunks(removed, 400)) {
          await q.run(`DELETE FROM taka_moves WHERE taka_id IN (${qs(part)})`, part)
          await q.run(`DELETE FROM takas WHERE id IN (${qs(part)})`, part)
        }
        const status = toMill ? 'MILL_GREY' : 'GODOWN_GREY'
        const existing = rows.filter((n) => n.id && byId.has(n.id))
        for (const part of chunks(existing, ROWS)) {
          const no = caseWhen(part, (n) => n.taka_no), gm = caseWhen(part, (n) => n.meter)
          await q.run(`UPDATE takas SET taka_no=${no.sql}, grey_meter=${gm.sql} WHERE id IN (${qs(part)})`, [...no.args, ...gm.args, ...part.map((n) => n.id)])
        }
        const fresh = rows.filter((n) => !(n.id && byId.has(n.id)))
        if (fresh.length) {
          const first = await q.one('SELECT COALESCE(MAX(id),0) AS m FROM takas')
          for (const part of chunks(fresh, ROWS)) {
            await q.run(`INSERT INTO takas (receipt_id,taka_no,grey_meter,status,location_id,mill_id,branch_id) VALUES ${part.map(() => '(?,?,?,?,?,?,?)').join(',')}`,
              part.flatMap((n) => [id, n.taka_no, n.meter, status, null, toMill ? r.mill_id : null, branchId]))
          }
          const added = await q.all('SELECT id FROM takas WHERE receipt_id=? AND id>? ORDER BY id', [id, first.m])
          await insertMoves(q, added.map((t) => ({ taka_id: t.id, from_status: null, to_status: status, mill_id: toMill ? r.mill_id : null, ref_type: 'RECEIPT', ref_id: id, note: 'ADDED BY EDIT' })))
        }
      }
    }
    return id
  })
}

// ---------------------------------------------------------------- mill challans (client change 4b)
// A mill challan is ALWAYS issued against weaver (grey) challans. Several weaver challans travel to the mill together, so one
// MAIN challan (mill_challan_mains, e.g. 121) holds one SUB-challan per weaver challan (mill_dispatches rows: 121A, 121B, …).
// Old rows without main_id (earlier data) stay readable as "Old challan DC-0001".
const SUB_COUNT = `(SELECT COUNT(*) FROM takas t WHERE t.dispatch_id=d.id) AS taka_count,
  (SELECT ROUND(COALESCE(SUM(grey_meter),0),2) FROM takas t WHERE t.dispatch_id=d.id) AS total_m`
const DS_SQL = `SELECT d.*, m.name AS mill_name, m.gstin AS mill_gstin, ${SUB_COUNT},
  r.challan_no AS weaver_challan, r.date AS weaver_date, w.name AS weaver_name, g.name AS group_name, pq.nick_name AS quality_nick,
  (SELECT GROUP_CONCAT(DISTINCT q.nick_name) FROM takas t JOIN grey_receipts r2 ON r2.id=t.receipt_id JOIN grey_pos p ON p.id=r2.po_id JOIN qualities q ON q.id=p.quality_id WHERE t.dispatch_id=d.id) AS qualities
  FROM mill_dispatches d JOIN mills m ON m.id=d.mill_id
  LEFT JOIN grey_receipts r ON r.id=d.receipt_id LEFT JOIN weavers w ON w.id=r.weaver_id LEFT JOIN weaver_groups g ON g.id=w.group_id
  LEFT JOIN grey_pos pp ON pp.id=r.po_id LEFT JOIN qualities pq ON pq.id=pp.quality_id`
const MAIN_SQL = `SELECT mm.*, m.name AS mill_name, m.gstin AS mill_gstin,
  (SELECT COUNT(*) FROM mill_dispatches d WHERE d.main_id=mm.id) AS sub_count,
  (SELECT COUNT(*) FROM takas t JOIN mill_dispatches d ON d.id=t.dispatch_id WHERE d.main_id=mm.id) AS taka_count,
  (SELECT ROUND(COALESCE(SUM(t.grey_meter),0),2) FROM takas t JOIN mill_dispatches d ON d.id=t.dispatch_id WHERE d.main_id=mm.id) AS total_m,
  (SELECT GROUP_CONCAT(DISTINCT q.nick_name) FROM takas t JOIN mill_dispatches d ON d.id=t.dispatch_id JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id WHERE d.main_id=mm.id) AS qualities
  FROM mill_challan_mains mm JOIN mills m ON m.id=mm.mill_id`

/** The number the next main mill challan gets (1 for the first; editable on screen, re-decided inside the save). */
export const nextMainNo = async () => Number((await one('SELECT COALESCE(MAX(main_no),0)+1 AS n FROM mill_challan_mains')).n);

/** Sub-challan letter: 0→A … 25→Z, 26→AA, 27→AB … */
export const subSuffix = (n) => (n < 26 ? String.fromCharCode(65 + n) : subSuffix(Math.floor(n / 26) - 1) + String.fromCharCode(65 + (n % 26)))

/** One row per main challan, plus a row per old challan (kind 'old'). Mains carry their sub-challans (without takas). */
export async function listMillChallans() {
  const [mains, subs, olds] = await Promise.all([
    all(`${MAIN_SQL} ORDER BY mm.id DESC`),
    all(`${DS_SQL} WHERE d.main_id IS NOT NULL ORDER BY d.id`),
    all(`${DS_SQL} WHERE d.main_id IS NULL ORDER BY d.id DESC`),
  ])
  const rows = [
    ...mains.map((mm) => ({ ...mm, kind: 'main', label: `Challan ${mm.main_no}`, subs: subs.filter((s) => s.main_id === mm.id) })),
    ...olds.map((d) => ({ ...d, kind: 'old', label: `Old challan ${d.dispatch_no}`, main_no: null, status: 'OLD', sub_count: 0, subs: [] })),
  ]
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id)
}
export const listDispatches = listMillChallans

/** A main challan with its sub-challans, each with its takas. */
export async function getMillChallan(id) {
  const mm = await one(`${MAIN_SQL} WHERE mm.id=?`, [id])
  if (!mm) return null
  const [subs, takas] = await Promise.all([all(`${DS_SQL} WHERE d.main_id=? ORDER BY d.id`, [id]), listTakas('WHERE d.main_id=?', [id])])
  return { ...mm, kind: 'main', subs: subs.map((s) => ({ ...s, takas: takas.filter((t) => t.dispatch_id === s.id) })) }
}
/** An old challan (no main) — the previous single-challan view. */
export async function getDispatch(id) {
  const d = await one(`${DS_SQL} WHERE d.id=?`, [id])
  if (!d) return null
  return { ...d, takas: await listTakas('WHERE t.dispatch_id=?', [id]) }
}

/** Weaver challans that still have takas in our godown: [{id, challan_no, weaver_name, group_name, nick_name, quality_id, branch_id, godown_count, godown_m}]. */
export function listGodownChallans({ branch_id, quality_id, weaver_id } = {}) {
  const where = [`r.destination='GODOWN'`], args = []
  if (branch_id) { where.push('t.branch_id=?'); args.push(branch_id) }
  if (quality_id) { where.push('p.quality_id=?'); args.push(quality_id) }
  if (weaver_id) { where.push('r.weaver_id=?'); args.push(weaver_id) }
  return all(`SELECT r.id, r.challan_no, r.date, r.weaver_id, w.name AS weaver_name, g.name AS group_name, q.id AS quality_id, q.nick_name, p.po_no,
    r.branch_id, br.name AS branch_name, COUNT(t.id) AS godown_count, ROUND(SUM(t.grey_meter),2) AS godown_m
    FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id
    JOIN weavers w ON w.id=r.weaver_id JOIN weaver_groups g ON g.id=w.group_id LEFT JOIN branches br ON br.id=r.branch_id
    WHERE t.status='GODOWN_GREY' AND ${where.join(' AND ')}
    GROUP BY r.id, r.challan_no, r.date, r.weaver_id, w.name, g.name, q.id, q.nick_name, p.po_no, r.branch_id, br.name
    ORDER BY r.date DESC, r.id DESC`, args)
}
/** The takas of one weaver challan that are still in the godown. */
export const godownTakasOfReceipt = (receiptId) => listTakas(`WHERE t.receipt_id=? AND t.status='GODOWN_GREY'`, [receiptId])

/** Validates parts and returns them cleaned. parts: [{receipt_id, taka_ids}] */
function cleanParts(parts) {
  if (!parts?.length) bad('Add at least one weaver challan')
  const seenReceipt = new Set(), seenTaka = new Set()
  return parts.map((p, i) => {
    const rid = Number(p.receipt_id)
    if (!rid) bad(`Part ${i + 1}: choose the weaver challan`)
    if (seenReceipt.has(rid)) bad('The same weaver challan appears twice in this save — put all its takas in one part')
    seenReceipt.add(rid)
    const ids = (p.taka_ids || []).map(Number)
    if (!ids.length) bad(`Part ${i + 1}: select at least one taka`)
    for (const id of ids) { if (seenTaka.has(id)) bad('The same taka was selected more than once'); seenTaka.add(id) }
    return { receipt_id: rid, taka_ids: ids }
  })
}
/** Moves a part's takas to the mill under sub-challan `subId`. Returns nothing; throws when anything is off. */
async function sendPart(q, part, subId, mill_id) {
  const rows = await requireTakas(q, part.taka_ids, 'GODOWN_GREY', 'send to mill')
  const wrong = rows.filter((t) => Number(t.receipt_id) !== part.receipt_id)
  if (wrong.length) bad(`${wrong.length} selected taka(s) are not from the chosen weaver challan`)
  await updateTakas(q, rows.map((t) => t.id), `status='MILL_GREY', mill_id=?, dispatch_id=?, location_id=NULL`, [mill_id, subId], 'GODOWN_GREY')
  await insertMoves(q, rows.map((t) => ({ taka_id: t.id, from_status: 'GODOWN_GREY', to_status: 'MILL_GREY', from_location_id: t.location_id, mill_id, ref_type: 'DISPATCH', ref_id: subId, note: 'SENT TO MILL' })))
}
async function requireGodownReceipt(q, receiptId) {
  const r = await q.one('SELECT id, destination, challan_no FROM grey_receipts WHERE id=?', [receiptId])
  if (!r) bad('Weaver challan not found')
  if (r.destination !== 'GODOWN') bad(`Challan ${r.challan_no} was delivered directly to a mill — it cannot be sent again`)
  return r
}

async function createMillChallanTx(q, { main_no, mill_id, date, notes, parts }) {
  const clean = cleanParts(parts)
  if (!mill_id) bad('Choose a mill')
  if (!date) bad('Date is required')
  if (!(await q.one('SELECT id FROM mills WHERE id=?', [mill_id]))) bad('Mill not found')
  let no
  if (main_no !== undefined && main_no !== null && String(main_no).trim() !== '') {
    no = Number(main_no)
    if (!Number.isInteger(no) || no < 1) bad('Challan number must be a whole number, 1 or more')
    if (await q.one('SELECT id FROM mill_challan_mains WHERE main_no=?', [no])) bad(`Mill challan number ${no} is already used`)
  } else {
    no = Number((await q.one('SELECT COALESCE(MAX(main_no),0)+1 AS n FROM mill_challan_mains')).n)
  }
  const { lastId: mainId } = await q.run('INSERT INTO mill_challan_mains (main_no,date,mill_id,notes,status,created_at) VALUES (?,?,?,?,?,?)', [no, date, mill_id, notes || null, 'OPEN', nowIso()])
  for (const [i, part] of clean.entries()) {
    await requireGodownReceipt(q, part.receipt_id)
    const suffix = subSuffix(i)
    const { lastId: subId } = await q.run('INSERT INTO mill_dispatches (dispatch_no,date,mill_id,notes,main_id,receipt_id,suffix) VALUES (?,?,?,?,?,?,?)', [`${no}${suffix}`, date, mill_id, null, mainId, part.receipt_id, suffix])
    await sendPart(q, part, subId, mill_id)
  }
  return mainId
}
/**
 * One main challan with one sub-challan per weaver challan, in one transaction.
 * d: {main_no?, mill_id, date, notes, parts:[{receipt_id, taka_ids}]}. Returns the main id.
 */
export const createMillChallan = (d) => tx((q) => createMillChallanTx(q, d))

/** Adds weaver challans to an OPEN main. A weaver challan that already has a sub extends that sub (same letter). */
export async function addToMillChallan(mainId, parts) {
  const clean = cleanParts(parts)
  return tx(async (q) => {
    const mm = await q.one('SELECT * FROM mill_challan_mains WHERE id=?', [mainId])
    if (!mm) bad('Mill challan not found')
    if (mm.status !== 'OPEN') bad('This mill challan is closed — re-open it to add more')
    const subs = await q.all('SELECT id, receipt_id FROM mill_dispatches WHERE main_id=? ORDER BY id', [mainId])
    let next = subs.length
    for (const part of clean) {
      await requireGodownReceipt(q, part.receipt_id)
      let sub = subs.find((s) => Number(s.receipt_id) === part.receipt_id)
      if (!sub) {
        const suffix = subSuffix(next++)
        const { lastId } = await q.run('INSERT INTO mill_dispatches (dispatch_no,date,mill_id,notes,main_id,receipt_id,suffix) VALUES (?,?,?,?,?,?,?)', [`${mm.main_no}${suffix}`, mm.date, mm.mill_id, null, mainId, part.receipt_id, suffix])
        sub = { id: lastId, receipt_id: part.receipt_id }
        subs.push(sub)
      }
      await sendPart(q, part, sub.id, mm.mill_id)
    }
    return mainId
  })
}
async function setMillChallanStatus(mainId, status) {
  const r = await run('UPDATE mill_challan_mains SET status=? WHERE id=?', [status, mainId])
  if (!r.changes) bad('Mill challan not found')
}
/** Closed = no more additions. Reversible. */
export const closeMillChallan = (mainId) => setMillChallanStatus(mainId, 'CLOSED')
export const reopenMillChallan = (mainId) => setMillChallanStatus(mainId, 'OPEN')

/** Kept for compatibility (tests, scripts): sends takas as ONE main with a sub per weaver challan. Returns the main id. */
export async function createDispatch({ mill_id, date, notes, taka_ids }) {
  if (!taka_ids?.length) bad('Select takas to send')
  if (!mill_id) bad('Choose a mill')
  if (!date) bad('Date is required')
  return tx(async (q) => {
    const ids = taka_ids.map(Number)
    const rows = []
    for (const part of chunks(ids, 400)) rows.push(...(await q.all(`SELECT id, receipt_id FROM takas WHERE id IN (${qs(part)})`, part)))
    if (rows.length !== new Set(ids).size) bad('Some selected takas no longer exist')
    const byReceipt = new Map()
    for (const t of rows) { if (!byReceipt.has(t.receipt_id)) byReceipt.set(t.receipt_id, []); byReceipt.get(t.receipt_id).push(t.id) }
    const parts = [...byReceipt.entries()].map(([receipt_id, tids]) => ({ receipt_id, taka_ids: tids }))
    return createMillChallanTx(q, { mill_id, date, notes, parts })
  })
}
/** Retired with racks (unused by the UI): where each taka of an old challan was taken from. */
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

// ---------------------------------------------------------------- dyeing programs
const PG_QUALS = (col) => `(SELECT GROUP_CONCAT(DISTINCT qq.${col}) FROM program_lines pl2 JOIN qualities qq ON qq.id=COALESCE(pl2.quality_id,pr.quality_id) WHERE pl2.program_id=pr.id)`
const PG_SQL = `SELECT pr.*, m.name AS mill_name, m.gstin AS mill_gstin, ${PG_QUALS('nick_name')} AS nick_name, ${PG_QUALS('original_name')} AS original_name,
  (SELECT GROUP_CONCAT(DISTINCT COALESCE(pl2.quality_id,pr.quality_id)) FROM program_lines pl2 WHERE pl2.program_id=pr.id) AS quality_ids,
  (SELECT COUNT(DISTINCT pl2.receipt_id) FROM program_lines pl2 WHERE pl2.program_id=pr.id AND pl2.receipt_id IS NOT NULL) AS challan_count,
  (SELECT COALESCE(SUM(taka_count),0) FROM program_lines WHERE program_id=pr.id) AS total_takas,
  (SELECT COUNT(*) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE pl.program_id=pr.id AND t.finished_receipt_id IS NOT NULL) AS received_takas,
  (SELECT ROUND(COALESCE(SUM(t.grey_meter),0),2) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE pl.program_id=pr.id) AS grey_m
  FROM programs pr JOIN mills m ON m.id=pr.mill_id`
const LINES_SQL = `SELECT pl.*, COALESCE(pl.quality_id, pr.quality_id) AS line_quality_id, lq.nick_name AS quality_nick, rc.challan_no AS weaver_challan, rc.date AS weaver_date, rc.destination AS weaver_destination,
  rw.name AS weaver_name, rg.name AS group_name,
  (SELECT GROUP_CONCAT(DISTINCT d.dispatch_no) FROM takas t JOIN mill_dispatches d ON d.id=t.dispatch_id WHERE t.program_line_id=pl.id) AS sub_nos,
  s.number AS shade_no, s.name AS shade_name, s.hex, s.image_url AS shade_image,
  (SELECT COUNT(*) FROM takas t WHERE t.program_line_id=pl.id) AS allocated,
  (SELECT COUNT(*) FROM takas t WHERE t.program_line_id=pl.id AND t.finished_receipt_id IS NOT NULL) AS received,
  (SELECT ROUND(COALESCE(SUM(t.grey_meter),0),2) FROM takas t WHERE t.program_line_id=pl.id) AS grey_m,
  (SELECT ROUND(COALESCE(SUM(t.finished_meter),0),2) FROM takas t WHERE t.program_line_id=pl.id AND t.finished_receipt_id IS NOT NULL) AS finished_m
  FROM program_lines pl JOIN shades s ON s.id=pl.shade_id JOIN programs pr ON pr.id=pl.program_id
  JOIN qualities lq ON lq.id=COALESCE(pl.quality_id, pr.quality_id)
  LEFT JOIN grey_receipts rc ON rc.id=pl.receipt_id LEFT JOIN weavers rw ON rw.id=rc.weaver_id LEFT JOIN weaver_groups rg ON rg.id=rw.group_id`
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

/**
 * Takas of a program are taken first-in-first-out from "grey at that mill" of the chosen quality.
 * Lines pick colours of the quality ({shade_id, taka_count}); the colour must be linked and active for that quality.
 */
async function createProgramLegacy({ mill_id, quality_id, date, notes, lines, total_takas }) {
  if (!mill_id || !quality_id) bad('Choose mill and quality')
  if (!date) bad('Date is required')
  const valid = (lines || []).filter((l) => l.shade_id && Number(l.taka_count) > 0)
  if (!valid.length) bad('Add at least one colour line')
  const seen = new Set()
  for (const l of valid) {
    if (!Number.isInteger(Number(l.taka_count))) bad('Taka counts must be whole numbers')
    if (seen.has(Number(l.shade_id))) bad('Each colour can appear only once in a program')
    seen.add(Number(l.shade_id))
  }
  const need = valid.reduce((s, l) => s + Number(l.taka_count), 0)
  if (total_takas != null && total_takas !== '' && Number(total_takas) !== need) bad(`Colour split adds up to ${need} takas but the program is for ${Number(total_takas)}`)
  return tx(async (q) => {
    await requireQualityColours(q, quality_id, valid.map((l) => l.shade_id), 'program')
    const avail = await millGreyTakas(mill_id, quality_id, q)
    if (need > avail.length) bad(`Only ${avail.length} grey takas of this quality are available at this mill (you asked for ${need})`)
    const chart = await libraryChartId(q)
    const no = await nextNo('programs', 'PG', q)
    const { lastId } = await q.run('INSERT INTO programs (program_no,date,mill_id,quality_id,chart_id,notes) VALUES (?,?,?,?,?,?)', [no, date, mill_id, quality_id, chart, notes || null])
    let cursor = 0
    for (const l of valid) {
      const { lastId: lineId } = await q.run('INSERT INTO program_lines (program_id,shade_id,taka_count,quality_id) VALUES (?,?,?,?)', [lastId, l.shade_id, Number(l.taka_count), quality_id])
      const picked = avail.slice(cursor, cursor + Number(l.taka_count))
      cursor += picked.length
      await updateTakas(q, picked.map((t) => t.id), `status='IN_DYEING', program_line_id=?`, [lineId], 'MILL_GREY')
      await insertMoves(q, picked.map((t) => ({ taka_id: t.id, from_status: 'MILL_GREY', to_status: 'IN_DYEING', mill_id, ref_type: 'PROGRAM', ref_id: lastId, note: 'PROGRAM' })))
    }
    return lastId
  })
}

// ---- programs against weaver challans (client changes 3)
// A program belongs to one mill and holds lines of "one weaver challan + one shade". The user chooses the exact takas.
// programs.quality_id only keeps the quality of the FIRST line (NOT NULL in the schema): read a line's quality as COALESCE(pl.quality_id, pr.quality_id).

/** Qualities that have grey (MILL_GREY) at this mill: [{quality_id, nick_name, takas, m}]. */
export async function qualitiesAtMill(millId) {
  const rows = await all(`SELECT p.quality_id, q.nick_name, COUNT(*) AS takas, ROUND(SUM(t.grey_meter),2) AS m
    FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id
    WHERE t.status='MILL_GREY' AND t.mill_id=? GROUP BY p.quality_id, q.nick_name ORDER BY q.nick_name`, [millId])
  return rows.map((r) => ({ ...r, takas: Number(r.takas), m: r2(r.m) }))
}
/**
 * The weavers (party + group) with grey of `qualityId` at this mill, each with its weaver challans that still have such takas:
 * [{weaver_id, weaver_name, group_name, challans:[{id, challan_no, date, takas, m, direct, sub_no}]}]. `direct` = delivered straight to the mill,
 * otherwise `sub_no` is our mill (sub-)challan number, e.g. 12B. Without qualityId every quality is included (each challan carries its quality).
 */
export async function millChallansForProgram(millId, qualityId) {
  const args = [millId]
  if (qualityId) args.push(qualityId)
  const rows = await all(`SELECT r.id, r.challan_no, r.date, r.weaver_id, r.destination, w.name AS weaver_name, g.name AS group_name, p.quality_id, q.nick_name,
    COUNT(t.id) AS takas, ROUND(SUM(t.grey_meter),2) AS m, GROUP_CONCAT(DISTINCT d.dispatch_no) AS sub_nos
    FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id
    JOIN weavers w ON w.id=r.weaver_id JOIN weaver_groups g ON g.id=w.group_id LEFT JOIN mill_dispatches d ON d.id=t.dispatch_id
    WHERE t.status='MILL_GREY' AND t.mill_id=? ${qualityId ? 'AND p.quality_id=?' : ''}
    GROUP BY r.id, r.challan_no, r.date, r.weaver_id, r.destination, w.name, g.name, p.quality_id, q.nick_name
    ORDER BY w.name, r.date, r.id`, args)
  const out = []
  for (const r of rows) {
    let w = out.find((x) => x.weaver_id === r.weaver_id)
    if (!w) { w = { weaver_id: r.weaver_id, weaver_name: r.weaver_name, group_name: r.group_name, challans: [] }; out.push(w) }
    w.challans.push({ id: r.id, challan_no: r.challan_no, date: r.date, quality_id: r.quality_id, nick_name: r.nick_name, takas: Number(r.takas), m: r2(r.m), direct: r.destination === 'MILL', sub_no: r.sub_nos || null })
  }
  return out
}
/** The takas of one weaver challan that are still grey at this mill. */
export const programTakasOfReceipt = (millId, receiptId) => listTakas(`WHERE t.status='MILL_GREY' AND t.mill_id=? AND t.receipt_id=?`, [millId, receiptId])

/** Validates parts [{receipt_id, lines:[{shade_id, taka_ids}]}] against the database; returns merged lines [{receipt_id, quality_id, shade_id, ids}] (receipt + shade once). */
async function checkProgramParts(q, millId, parts) {
  if (!parts?.length) bad('Add at least one weaver challan')
  const merged = new Map(), all_ = []
  for (const [i, part] of parts.entries()) {
    const rid = Number(part.receipt_id)
    if (!rid) bad(`Part ${i + 1}: choose the weaver challan`)
    for (const l of part.lines || []) {
      const ids = (l.taka_ids || []).map(Number)
      if (!ids.length) continue
      if (!Number(l.shade_id)) bad(`Part ${i + 1}: choose a colour for the selected takas`)
      const key = `${rid}:${Number(l.shade_id)}`
      if (!merged.has(key)) merged.set(key, { receipt_id: rid, shade_id: Number(l.shade_id), ids: [] })
      merged.get(key).ids.push(...ids); all_.push(...ids)
    }
  }
  if (!all_.length) bad('Select at least one taka and give it a colour')
  if (new Set(all_).size !== all_.length) bad('The same taka was selected more than once')
  const found = await requireTakas(q, all_, 'MILL_GREY', 'put in a program')
  const byId = new Map(found.map((t) => [Number(t.id), t]))
  const quality = new Map()
  const rids = [...new Set([...merged.values()].map((l) => l.receipt_id))]
  for (const r of await q.all(`SELECT r.id, p.quality_id FROM grey_receipts r JOIN grey_pos p ON p.id=r.po_id WHERE r.id IN (${qs(rids)})`, rids)) quality.set(Number(r.id), Number(r.quality_id))
  if (quality.size !== rids.length) bad('Weaver challan not found')
  for (const l of merged.values()) {
    for (const id of l.ids) {
      const t = byId.get(id)
      if (Number(t.mill_id) !== Number(millId)) bad(`Taka ${t.challan_no}/${t.taka_no} is not grey at this mill`)
      if (Number(t.receipt_id) !== l.receipt_id) bad(`Taka ${t.challan_no}/${t.taka_no} is not from the chosen weaver challan`)
    }
    l.quality_id = quality.get(l.receipt_id)
  }
  // every colour must be linked AND active for the quality of its weaver challan
  const perQuality = new Map()
  for (const l of merged.values()) { if (!perQuality.has(l.quality_id)) perQuality.set(l.quality_id, []); perQuality.get(l.quality_id).push(l.shade_id) }
  for (const [qid, shades] of perQuality) await requireQualityColours(q, qid, shades, 'program')
  return [...merged.values()]
}
/** Inserts / extends program lines for the checked lines and moves their takas to IN_DYEING. */
async function placeProgramLines(q, programId, millId, lines) {
  const existing = await q.all('SELECT id, receipt_id, shade_id FROM program_lines WHERE program_id=? AND receipt_id IS NOT NULL', [programId])
  const lineOf = new Map(existing.map((l) => [`${l.receipt_id}:${l.shade_id}`, Number(l.id)]))
  const fresh = lines.filter((l) => !lineOf.has(`${l.receipt_id}:${l.shade_id}`))
  for (const part of chunks(fresh, ROWS)) {
    await q.run(`INSERT INTO program_lines (program_id,shade_id,taka_count,quality_id,receipt_id) VALUES ${part.map(() => '(?,?,?,?,?)').join(',')}`, part.flatMap((l) => [programId, l.shade_id, l.ids.length, l.quality_id, l.receipt_id]))
  }
  if (fresh.length) {
    for (const l of await q.all('SELECT id, receipt_id, shade_id FROM program_lines WHERE program_id=? AND receipt_id IS NOT NULL', [programId])) lineOf.set(`${l.receipt_id}:${l.shade_id}`, Number(l.id))
  }
  for (const l of lines.filter((x) => !fresh.includes(x))) await q.run('UPDATE program_lines SET taka_count=taka_count+? WHERE id=?', [l.ids.length, lineOf.get(`${l.receipt_id}:${l.shade_id}`)])
  const rows = lines.flatMap((l) => l.ids.map((id) => ({ id, line_id: lineOf.get(`${l.receipt_id}:${l.shade_id}`) })))
  await updateTakasEach(q, rows, `status='IN_DYEING'`, [], { program_line_id: (r) => r.line_id }, 'MILL_GREY')
  await insertMoves(q, rows.map((r) => ({ taka_id: r.id, from_status: 'MILL_GREY', to_status: 'IN_DYEING', mill_id: millId, ref_type: 'PROGRAM', ref_id: programId, note: 'PROGRAM' })))
}

/**
 * Issue a dyeing program against weaver challans. d: {mill_id, date, notes?, parts:[{receipt_id, lines:[{shade_id, taka_ids}]}]}.
 * The user picks the exact takas (grey at that mill) and gives them a colour of their quality. One transaction. Returns the program id.
 * Without `parts` the old signature ({mill_id, quality_id, date, lines:[{shade_id, taka_count}]}) still works (first-in-first-out; tests and scripts only).
 */
export async function createProgram(d) {
  if (!d.parts) return createProgramLegacy(d)
  const { mill_id, date, notes, parts } = d
  if (!mill_id) bad('Choose the mill')
  if (!date) bad('Date is required')
  return tx(async (q) => {
    if (!(await q.one('SELECT id FROM mills WHERE id=?', [mill_id]))) bad('Mill not found')
    const lines = await checkProgramParts(q, mill_id, parts)
    const chart = await libraryChartId(q)
    const no = await nextNo('programs', 'PG', q)
    const { lastId } = await q.run('INSERT INTO programs (program_no,date,mill_id,quality_id,chart_id,notes) VALUES (?,?,?,?,?,?)', [no, date, mill_id, lines[0].quality_id, chart, notes || null])
    await placeProgramLines(q, lastId, mill_id, lines)
    return lastId
  })
}
/** Add more takas to a program that is not Done yet (same checks; a receipt + shade that already has a line extends it). */
export async function addToProgram(programId, parts) {
  return tx(async (q) => {
    const p = await q.one(`${PG_SQL} WHERE pr.id=?`, [programId])
    if (!p) bad('Program not found')
    if (progStatus(p) === 'DONE') bad('This program is fully received — takas can no longer be added')
    const lines = await checkProgramParts(q, p.mill_id, parts)
    await placeProgramLines(q, programId, p.mill_id, lines)
    return programId
  })
}

// ---------------------------------------------------------------- finished receipts (mill challan back to us)
const FR_SQL = `SELECT fr.*, pr.program_no, pr.mill_id, m.name AS mill_name,
  (SELECT GROUP_CONCAT(DISTINCT qq.nick_name) FROM program_lines pl2 JOIN qualities qq ON qq.id=COALESCE(pl2.quality_id,pr.quality_id) WHERE pl2.program_id=pr.id) AS nick_name,
  (SELECT GROUP_CONCAT(DISTINCT t.lot_no) FROM takas t WHERE t.finished_receipt_id=fr.id AND t.lot_no IS NOT NULL) AS lots,
  (SELECT COUNT(*) FROM takas t WHERE t.finished_receipt_id=fr.id) AS taka_count,
  (SELECT ROUND(COALESCE(SUM(grey_meter),0),2) FROM takas t WHERE t.finished_receipt_id=fr.id) AS grey_m,
  (SELECT ROUND(COALESCE(SUM(finished_meter),0),2) FROM takas t WHERE t.finished_receipt_id=fr.id) AS finished_m
  FROM finished_receipts fr JOIN programs pr ON pr.id=fr.program_id JOIN mills m ON m.id=pr.mill_id`
export const listFinishedReceipts = (where = '', args = []) => all(`${FR_SQL} ${where} ORDER BY fr.id DESC`, args)

/**
 * rows: [{id, finished_meter}] — partial returns allowed; each taka can be received once.
 * The grey meter is the weaver challan meter (mill_grey_meter is kept in the table = grey_meter); a different value is refused.
 */
async function createFinishedReceiptLegacy({ program_id, challan_no, date, image_url, notes, rows }) {
  if (!rows?.length) bad('Select received takas')
  if (!String(challan_no || '').trim()) bad('Mill challan number is required')
  if (!date) bad('Date is required')
  const clean = rows.map((r) => ({ id: Number(r.id), fin: meters2(r.finished_meter, 'Finished meter'), grey: r.mill_grey_meter === undefined || r.mill_grey_meter === null || r.mill_grey_meter === '' ? null : Number(r.mill_grey_meter) }))
  return tx(async (q) => {
    const prog = await q.one('SELECT id FROM programs WHERE id=?', [program_id])
    if (!prog) bad('Program not found')
    const found = await requireTakas(q, clean.map((r) => r.id), 'IN_DYEING', 'receive')
    const lines = await q.all('SELECT id FROM program_lines WHERE program_id=?', [program_id])
    const lineIds = new Set(lines.map((l) => l.id))
    if (found.some((t) => !lineIds.has(t.program_line_id))) bad('Some takas do not belong to this program')
    const greyOf = new Map(found.map((t) => [t.id, Number(t.grey_meter)]))
    if (clean.some((r) => r.grey != null && r2(r.grey) !== r2(greyOf.get(r.id)))) bad('The grey meter comes from the weaver challan and cannot be changed here')
    const { lastId } = await q.run('INSERT INTO finished_receipts (program_id,challan_no,date,image_url,notes) VALUES (?,?,?,?,?)', [program_id, String(challan_no).trim(), date, image_url || null, notes || null])
    await updateTakasEach(q, clean, `status='FINISHED', finished_receipt_id=?, mill_grey_meter=grey_meter, lot_no=(SELECT pl.lot_no FROM program_lines pl WHERE pl.id=takas.program_line_id)`, [lastId], { finished_meter: (r) => r.fin }, 'IN_DYEING')
    await insertMoves(q, clean.map((r) => ({ taka_id: r.id, from_status: 'IN_DYEING', to_status: 'FINISHED', ref_type: 'MILL_RECEIPT', ref_id: lastId, note: 'FINISHED RECEIVED' })))
    return lastId
  })
}

/**
 * A mill return challan for ONE program, by weaver challan / shade line, with a lot number per line.
 * d: {program_id, challan_no, date, notes?, image_url?, lines:[{program_line_id, lot_no, rows:[{id, finished_meter}]}]}.
 * One lot number per program line: the first receipt sets it, later receipts of that line must repeat it. Partial receipts any number of times.
 * Without `lines` the old row-only signature ({program_id, challan_no, date, rows}) still works (no lot required; tests and scripts only).
 */
export async function createFinishedReceipt(d) {
  if (!d.lines) return createFinishedReceiptLegacy(d)
  const { program_id, challan_no, date, image_url, notes } = d
  if (!String(challan_no || '').trim()) bad('Mill challan number is required')
  if (!date) bad('Date is required')
  const lines = d.lines.map((l) => ({
    line_id: Number(l.program_line_id), lot: String(l.lot_no ?? '').trim(),
    rows: (l.rows || []).map((r) => ({ id: Number(r.id), fin: meters2(r.finished_meter, 'Finished meter') })),
  })).filter((l) => l.rows.length)
  if (!lines.length) bad('Select received takas')
  if (new Set(lines.map((l) => l.line_id)).size !== lines.length) bad('The same program line appears twice in this receipt')
  for (const l of lines) if (!l.lot) bad('Enter the lot number of every colour that is received')
  return tx(async (q) => {
    if (!(await q.one('SELECT id FROM programs WHERE id=?', [program_id]))) bad('Program not found')
    const pls = await q.all('SELECT id, lot_no FROM program_lines WHERE program_id=?', [program_id])
    const plById = new Map(pls.map((l) => [Number(l.id), l]))
    for (const l of lines) {
      const pl = plById.get(l.line_id)
      if (!pl) bad('Some lines do not belong to this program')
      if (pl.lot_no && pl.lot_no !== l.lot) bad(`This colour already has lot number ${pl.lot_no} — a different lot (${l.lot}) cannot be used`)
    }
    const all_ = lines.flatMap((l) => l.rows.map((r) => ({ ...r, line_id: l.line_id, lot: l.lot })))
    const found = await requireTakas(q, all_.map((r) => r.id), 'IN_DYEING', 'receive')
    const lineOfTaka = new Map(found.map((t) => [Number(t.id), Number(t.program_line_id)]))
    if (all_.some((r) => lineOfTaka.get(r.id) !== r.line_id)) bad('Some takas do not belong to the line they were received on')
    const { lastId } = await q.run('INSERT INTO finished_receipts (program_id,challan_no,date,image_url,notes) VALUES (?,?,?,?,?)', [program_id, String(challan_no).trim(), date, image_url || null, notes || null])
    for (const l of lines) if (!plById.get(l.line_id).lot_no) await q.run('UPDATE program_lines SET lot_no=? WHERE id=? AND lot_no IS NULL', [l.lot, l.line_id])
    await updateTakasEach(q, all_, `status='FINISHED', finished_receipt_id=?, mill_grey_meter=grey_meter`, [lastId], { finished_meter: (r) => r.fin, lot_no: (r) => r.lot }, 'IN_DYEING')
    await insertMoves(q, all_.map((r) => ({ taka_id: r.id, from_status: 'IN_DYEING', to_status: 'FINISHED', ref_type: 'MILL_RECEIPT', ref_id: lastId, note: `FINISHED RECEIVED (LOT ${r.lot})` })))
    return lastId
  })
}

// ---------------------------------------------------------------- folding
/**
 * rows: [{id, folded_meter, damage?: {meters, image_url?, voice_url?, voice_local?, notes?}}].
 * Folding and its damage records are saved in one transaction. Returns {count, damages:[{taka_id, id}]}.
 * Damage cannot be edited after the folding is saved (open question in docs/SPEC.md).
 */
export async function foldTakas(rows, date = today()) {
  if (!rows?.length) bad('Select takas to fold')
  const clean = rows.map((r) => {
    const m = meters2(r.folded_meter, 'Folded meter')
    let damage = null
    if (r.damage) {
      const dm = meters2(r.damage.meters, 'Damaged meters')
      if (dm > m) bad('Damaged meters cannot be more than the folded meters')
      damage = { meters: dm, image_url: r.damage.image_url || null, voice_url: r.damage.voice_url || null, voice_local: r.damage.voice_local ? 1 : 0, notes: String(r.damage.notes || '').trim() || null }
    }
    return { id: Number(r.id), m, damage }
  })
  return tx(async (q) => {
    await requireTakas(q, clean.map((r) => r.id), 'FINISHED', 'fold')
    await updateTakasEach(q, clean, `status='FOLDED', folded_on=?`, [date], { folded_meter: (r) => r.m }, 'FINISHED')
    const hurt = clean.filter((r) => r.damage)
    const at = nowIso()
    for (const part of chunks(hurt, ROWS)) {
      await q.run(`INSERT INTO taka_damages (taka_id,meters,image_url,voice_url,voice_local,notes,at) VALUES ${part.map(() => '(?,?,?,?,?,?,?)').join(',')}`,
        part.flatMap((r) => [r.id, r.damage.meters, r.damage.image_url, r.damage.voice_url, r.damage.voice_local, r.damage.notes, at]))
    }
    await insertMoves(q, clean.map((r) => ({ taka_id: r.id, from_status: 'FINISHED', to_status: 'FOLDED', ref_type: 'FOLDING', note: r.damage ? `FOLDED (DAMAGED ${r.damage.meters} m)` : 'FOLDED' })))
    const damages = []
    for (const part of chunks(hurt.map((r) => r.id), 400)) damages.push(...(await q.all(`SELECT id, taka_id FROM taka_damages WHERE taka_id IN (${qs(part)})`, part)))
    return { count: clean.length, damages }
  })
}

// ---------------------------------------------------------------- customer orders
// An order line asks for a colour (of the order's quality) in TAKAS, in METERS, or both — orders often arrive in meters.
// Allocated meters are SELLABLE meters (folded − damaged).
const SELLABLE = `COALESCE(t.jw_return_meter, t.folded_meter - COALESCE((SELECT dd.meters FROM taka_damages dd WHERE dd.taka_id=t.id),0))`
const OR_SQL = `SELECT o.*, c.name AS customer_name, c.city AS customer_city, c.phone AS customer_phone, c.contact AS customer_contact, q.nick_name, q.original_name, q.taka_length AS quality_taka_length,
  (SELECT ROUND(COALESCE(SUM(amount),0),2) FROM order_payments op WHERE op.order_id=o.id) AS paid,
  (SELECT COUNT(*) FROM order_payments op WHERE op.order_id=o.id) AS payment_count,
  (SELECT COALESCE(SUM(taka_count),0) FROM order_lines WHERE order_id=o.id) AS total_takas,
  (SELECT ROUND(COALESCE(SUM(meters),0),2) FROM order_lines WHERE order_id=o.id) AS total_meters,
  (SELECT COUNT(*) FROM takas t WHERE t.order_id=o.id) AS allocated,
  (SELECT ROUND(COALESCE(SUM(${SELLABLE}),0),2) FROM takas t WHERE t.order_id=o.id) AS allocated_m
  FROM orders o JOIN customers c ON c.id=o.customer_id JOIN qualities q ON q.id=o.quality_id`
const OL_SQL = `SELECT ol.*, s.number AS shade_no, s.name AS shade_name, s.hex, s.image_url AS shade_image,
  (SELECT COUNT(*) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE t.order_id=ol.order_id AND pl.shade_id=ol.shade_id) AS allocated,
  (SELECT ROUND(COALESCE(SUM(${SELLABLE}),0),2) FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id WHERE t.order_id=ol.order_id AND pl.shade_id=ol.shade_id) AS allocated_m
  FROM order_lines ol JOIN shades s ON s.id=ol.shade_id`
/** A line is fulfilled when every unit it asks for (takas and/or meters) is covered. */
export const orderLineDone = (l) =>
  (Number(l.taka_count) > 0 || Number(l.meters) > 0) &&
  (!(Number(l.taka_count) > 0) || Number(l.allocated) >= Number(l.taka_count)) &&
  (!(Number(l.meters) > 0) || Number(l.allocated_m) >= Number(l.meters))
export async function listOrders(where = '', args = []) {
  const [orders, lines, days, events] = await Promise.all([all(`${OR_SQL} ${where} ORDER BY o.id DESC`, args), all(OL_SQL), getPaymentDays(), paymentEvents()])
  return orders.map((o) => {
    const ls = lines.filter((l) => l.order_id === o.id)
    return { ...o, lines: ls, payment: paymentInfo(o, ls, events.disp.get(o.id) || [], events.pays.get(o.id) || [], days) }
  })
}
export async function getOrder(id) {
  const o = await one(`${OR_SQL} WHERE o.id=?`, [id])
  if (!o) return null
  const [lines, takas, days, events, payments] = await Promise.all([
    all(`${OL_SQL} WHERE ol.order_id=? ORDER BY ol.id`, [id]), listTakas('WHERE t.order_id=?', [id]), getPaymentDays(), paymentEvents(o.id), listOrderPayments(o.id),
  ])
  const jobWorks = Number(o.job_work) === 1 ? await listJobWorks('WHERE c.order_id=?', [id]) : []
  return { ...o, lines, takas, jobWorks, payments, payment: paymentInfo(o, lines, events.disp.get(o.id) || [], events.pays.get(o.id) || [], days) }
}

// ---- payments against an order (client changes 5) ----
// Only DISPATCHED meters are billable: the sellable meters of the takas given to the order (status SOLD, order_id set) x the order rate.
// Reminder: the counter starts on the day the order first owes money (its first dispatch, or a dispatch after it was fully paid);
// every payment entry (even a part payment) restarts it from the payment date. When it reaches the order's reminder days
// (the settings default unless the order has its own) and money is still owed, the order shows "Payment due".
const addDays = (d, n) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10)
const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 864e5)

/** Dispatch days (meters given to the order per day) and payments, per order: {disp: Map(order_id -> [{d, m}]), pays: Map(order_id -> [{d, amount}])}. */
async function paymentEvents(orderId = null) {
  const only = orderId != null
  const [disp, pays] = await Promise.all([
    all(`SELECT m.ref_id AS order_id, substr(m.at,1,10) AS d, ROUND(COALESCE(SUM(${SELLABLE}),0),2) AS m
      FROM taka_moves m JOIN takas t ON t.id=m.taka_id
      WHERE m.ref_type='ORDER' AND m.to_status='SOLD' AND t.order_id=m.ref_id${only ? ' AND m.ref_id=?' : ''}
      GROUP BY m.ref_id, substr(m.at,1,10)`, only ? [orderId] : []),
    all(`SELECT order_id, date AS d, amount FROM order_payments${only ? ' WHERE order_id=?' : ''}`, only ? [orderId] : []),
  ])
  const group = (rows) => { const m = new Map(); for (const r of rows) { const k = Number(r.order_id); if (!m.has(k)) m.set(k, []); m.get(k).push(r) } return m }
  return { disp: group(disp), pays: group(pays) }
}

/**
 * Payment state of an order. Ordered meters: the line meters, or (taka-only lines) takas x the quality's taka length (`estimated` then).
 * expected = what the whole order will bill (a completed order bills what was dispatched); dispatched = billable now;
 * outstanding = dispatched amount - paid (null without a rate). `due` = the reminder is showing.
 */
export function paymentInfo(o, lines, disp, pays, defaultDays, todayStr = today()) {
  const rate = o.rate == null || o.rate === '' ? null : Number(o.rate)
  const own = o.payment_days != null && o.payment_days !== ''
  const days = own ? Number(o.payment_days) : defaultDays
  const tl = Number(o.quality_taka_length) || 100
  let ordered_m = 0, estimated = false
  for (const l of lines || []) {
    if (Number(l.meters) > 0) ordered_m += Number(l.meters)
    else if (Number(l.taka_count) > 0) { ordered_m += Number(l.taka_count) * tl; estimated = true }
  }
  ordered_m = r2(ordered_m)
  const dispatched_m = r2(o.allocated_m || 0)
  const expected_m = o.status === 'DONE' ? dispatched_m : Math.max(ordered_m, dispatched_m)
  const paid = r2(o.paid || 0)
  const amt = (m) => (rate == null ? null : r2(m * rate))
  const dispatched_amount = amt(dispatched_m)
  const expected_amount = amt(expected_m)
  const outstanding = dispatched_amount == null ? null : r2(dispatched_amount - paid)
  // walk dispatches and payments by date (a dispatch counts before a payment of the same day)
  const events = [...(disp || []).map((e) => ({ d: e.d, kind: 'D', v: Number(e.m) })), ...(pays || []).map((e) => ({ d: e.d, kind: 'P', v: Number(e.amount) }))]
    .filter((e) => e.d).sort((a, b) => a.d.localeCompare(b.d) || (a.kind === 'D' ? -1 : 1))
  let bal = 0, since = null
  for (const e of events) {
    if (e.kind === 'D') {
      if (rate == null) { if (!since) since = e.d; continue }
      if (bal <= 0.005) since = e.d
      bal = r2(bal + e.v * rate)
    } else if (rate == null) { if (since) since = e.d }
    else { bal = r2(bal - e.v); since = bal > 0.005 ? e.d : null }
  }
  const owing = dispatched_m > 0 && (outstanding == null || outstanding > 0.005)
  const due_on = owing && since ? addDays(since, days) : null
  const days_left = due_on ? dayDiff(todayStr, due_on) : null
  return {
    rate, days, own_days: own, ordered_m, estimated, expected_m, expected_amount,
    dispatched_m, dispatched_amount, paid, outstanding, balance: expected_amount == null ? null : r2(expected_amount - paid),
    payment_count: Number(o.payment_count ?? (pays || []).length), since: owing ? since : null, due_on, days_left,
    due: days_left != null && days_left <= 0, overdue_days: days_left != null && days_left < 0 ? -days_left : 0,
  }
}

export const listOrderPayments = (orderId) =>
  all('SELECT * FROM order_payments WHERE order_id=? ORDER BY date DESC, id DESC', [orderId])

/** Log a payment received against an order. d: {date, amount, mode?, ref_no?, notes?}. Several entries per order are allowed. */
export async function addOrderPayment(orderId, d) {
  const date = String(d.date || '').trim()
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) bad('Enter the payment date')
  const raw = typeof d.amount === 'string' ? d.amount.trim() : d.amount
  const amount = Number(raw)
  if (raw === '' || raw == null || !Number.isFinite(amount) || amount <= 0) bad('Enter an amount greater than 0')
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) bad('Amount can have at most 2 decimals')
  const t = (v) => String(v ?? '').trim() || null
  if (!(await one('SELECT id FROM orders WHERE id=?', [orderId]))) bad('Order not found')
  const { lastId } = await run('INSERT INTO order_payments (order_id,date,amount,mode,ref_no,notes,created_at) VALUES (?,?,?,?,?,?,?)',
    [orderId, date, r2(amount), t(d.mode), t(d.ref_no), t(d.notes), nowIso()])
  return lastId
}
export const removeOrderPayment = (paymentId) => run('DELETE FROM order_payments WHERE id=?', [paymentId])

/** Rate per meter (> 0, or empty = not set) and the order's own reminder days (empty = the settings default). Missing keys keep `current`. */
function cleanPayFields(d, current = {}) {
  const has = (k) => Object.prototype.hasOwnProperty.call(d, k)
  const v = (x) => (typeof x === 'string' ? x.trim() : x)
  let rate = has('rate') ? v(d.rate) : current.rate
  rate = rate === '' || rate == null ? null : Number(rate)
  if (rate != null && (!Number.isFinite(rate) || rate <= 0)) bad('Rate per meter must be greater than 0')
  let pd = has('payment_days') ? v(d.payment_days) : current.payment_days
  pd = pd === '' || pd == null ? null : Number(pd)
  if (pd != null && (!Number.isInteger(pd) || pd < 1 || pd > 3650)) bad('Payment reminder: enter whole days between 1 and 3650')
  return { rate: rate == null ? null : Math.round(rate * 10000) / 10000, payment_days: pd }
}
/** Change only an order's reminder days (null = back to the settings default). */
export async function setOrderPaymentDays(orderId, days) {
  const { payment_days } = cleanPayFields({ payment_days: days })
  await run('UPDATE orders SET payment_days=? WHERE id=?', [payment_days, orderId])
  return payment_days
}
/** Job-work fields of an order (R-SO-3): the switch is needed for a job type / note to count. */
function cleanJobFields(d) {
  const on = d.job_work === true || d.job_work === 1 || d.job_work === '1'
  const t = (v) => (String(v ?? '').trim() || null)
  return { job_work: on ? 1 : 0, job_type: on ? t(d.job_type) : null, job_notes: on ? t(d.job_notes) : null }
}

/** Validates + normalises order lines. Each line: {shade_id, taka_count?, meters?}; the colour must be linked and active for the quality. */
async function cleanOrderLines(q, quality_id, lines, keep) {
  const valid = (lines || []).filter((l) => l.shade_id && (Number(l.taka_count) > 0 || Number(l.meters) > 0))
  if (!valid.length) bad('Add at least one line with takas or meters')
  const out = []
  for (const l of valid) {
    const taka_count = l.taka_count === '' || l.taka_count == null ? 0 : Number(l.taka_count)
    if (!Number.isInteger(taka_count) || taka_count < 0) bad('Taka counts must be whole numbers')
    const meters = l.meters === '' || l.meters == null || Number(l.meters) === 0 ? null : meters2(l.meters, 'Order meters')
    if (!taka_count && !meters) bad('Each line needs takas or meters')
    out.push({ shade_id: Number(l.shade_id), taka_count, meters })
  }
  if (new Set(out.map((l) => l.shade_id)).size !== out.length) bad('Each colour can appear only once in an order')
  await requireQualityColours(q, quality_id, out.map((l) => l.shade_id), 'order', keep)
  return out
}
const insertOrderLines = async (q, orderId, lines) => {
  for (const part of chunks(lines, ROWS)) {
    await q.run(`INSERT INTO order_lines (order_id,shade_id,taka_count,meters) VALUES ${part.map(() => '(?,?,?,?)').join(',')}`, part.flatMap((l) => [orderId, l.shade_id, l.taka_count, l.meters]))
  }
}

export async function createOrder({ order_no, date, customer_id, quality_id, notes, lines, ...jobFields }) {
  const pf = cleanPayFields(jobFields)
  const no = String(order_no || '').trim()
  if (!no) bad('Order number is required')
  if (!customer_id || !quality_id) bad('Choose customer and quality')
  return tx(async (q) => {
    const clean = await cleanOrderLines(q, quality_id, lines)
    if (await q.one('SELECT id FROM orders WHERE LOWER(order_no)=?', [no.toLowerCase()])) bad(`Order number ${no} already exists`)
    const jf = cleanJobFields(jobFields)
    const { lastId } = await q.run('INSERT INTO orders (order_no,date,customer_id,quality_id,notes,job_work,job_type,job_notes,rate,payment_days) VALUES (?,?,?,?,?,?,?,?,?,?)', [no, date || today(), customer_id, quality_id, notes || null, jf.job_work, jf.job_type, jf.job_notes, pf.rate, pf.payment_days])
    await insertOrderLines(q, lastId, clean)
    return lastId
  })
}

/**
 * Edit an order. Header fields (number, date, customer, notes) can always change; the quality and the lines only
 * while nothing has been allocated to the order yet. Colours already on the order stay allowed even if made inactive since.
 */
export async function updateOrder(id, { order_no, date, customer_id, quality_id, notes, lines, ...jobFields }) {
  const no = String(order_no || '').trim()
  if (!no) bad('Order number is required')
  if (!customer_id || !quality_id) bad('Choose customer and quality')
  return tx(async (q) => {
    const o = await q.one('SELECT * FROM orders WHERE id=?', [id])
    if (!o) bad('Order not found')
    if (await q.one('SELECT id FROM orders WHERE LOWER(order_no)=? AND id<>?', [no.toLowerCase(), id])) bad(`Order number ${no} already exists`)
    if (!(await q.one('SELECT id FROM customers WHERE id=?', [customer_id]))) bad('Customer not found')
    const pf = cleanPayFields(jobFields, o)
    const allocated = Number((await q.one('SELECT COUNT(*) AS c FROM takas WHERE order_id=?', [id])).c)
    if (allocated > 0) {
      if (Number(quality_id) !== Number(o.quality_id)) bad('Quality cannot change after stock was allocated to this order')
      await q.run('UPDATE orders SET order_no=?, date=?, customer_id=?, notes=?, rate=?, payment_days=? WHERE id=?', [no, date || o.date, customer_id, notes || null, pf.rate, pf.payment_days, id])
      return id
    }
    const keep = Number(quality_id) === Number(o.quality_id) ? new Set((await q.all('SELECT shade_id FROM order_lines WHERE order_id=?', [id])).map((r) => Number(r.shade_id))) : new Set()
    const clean = await cleanOrderLines(q, quality_id, lines, keep)
    const jf = cleanJobFields(jobFields)
    if (Number(o.job_work) === 1 && !jf.job_work) {
      const linked = Number((await q.one('SELECT COUNT(*) AS c FROM job_work_challans WHERE order_id=?', [id])).c)
      if (linked > 0) bad('Unlink the job work challans from this order before turning "Job work required" off')
    }
    await q.run('UPDATE orders SET order_no=?, date=?, customer_id=?, quality_id=?, notes=?, status=?, job_work=?, job_type=?, job_notes=?, rate=?, payment_days=? WHERE id=?', [no, date || o.date, customer_id, quality_id, notes || null, 'OPEN', jf.job_work, jf.job_type, jf.job_notes, pf.rate, pf.payment_days, id])
    await q.run('DELETE FROM order_lines WHERE order_id=?', [id])
    await insertOrderLines(q, id, clean)
    return id
  })
}

/**
 * Allocation core (R-SO-4), shared by Auto-allocate and "Sell to order" from Inventory.
 * Allocates READY (folded) takas FIFO to each line → SOLD. A line in takas takes that many takas; a line in meters
 * takes whole takas until the SELLABLE meters (folded − damaged) reach the wanted meters (the last taka may overshoot — takas are not cut).
 * R-SO-3: a job-work order takes only job-worked takas (of the named type), a normal order only plain ones.
 * `wants` = [{ order_line_id, takas?, meters? }]; a line that is not listed (or has 0 / 0) gets nothing. `wants` = null → every line's full pending amount.
 * NOTE: this booking rule came from the generated app; the brief asks to treat booking/reservation as an
 * open question (docs/SPEC.md Q6). Availability checking (below) does not depend on it.
 */
const pendingOf = (l) => ({
  takas: Math.max(0, Number(l.taka_count) - Number(l.allocated)),
  meters: l.meters ? Math.max(0, r2(Number(l.meters) - Number(l.allocated_m))) : 0,
})
async function planOrderAllocation(q, o, lines, wants) {
  const jobOrder = Number(o.job_work) === 1
  const jwCond = jobOrder ? `AND t.jw_type IS NOT NULL${o.job_type ? ' AND LOWER(t.jw_type)=?' : ''}` : 'AND t.jw_type IS NULL'
  const byLine = wants ? new Map(wants.map((w) => [Number(w.order_line_id), w])) : null
  if (byLine && wants.some((w) => !lines.some((l) => Number(l.id) === Number(w.order_line_id)))) bad('Some lines do not belong to this order')
  const out = []
  for (const l of lines) {
    const pend = pendingOf(l)
    let needT = pend.takas, needM = pend.meters
    if (byLine) {
      const w = byLine.get(Number(l.id)) || {}
      const t = w.takas === '' || w.takas == null ? 0 : Number(w.takas)
      const m = w.meters === '' || w.meters == null ? 0 : Number(w.meters)
      if (!Number.isInteger(t) || t < 0) bad('Taka counts must be whole numbers')
      if (!Number.isFinite(m) || m < 0) bad('Meters cannot be negative')
      if (t > pend.takas && Number(l.taka_count) > 0) bad(`${l.shade_no}: only ${pend.takas} taka(s) are pending on this line`)
      if (r2(m) > pend.meters && Number(l.meters) > 0) bad(`${l.shade_no}: only ${r2(pend.meters).toFixed(2)} m are pending on this line`)
      needT = t; needM = r2(m)
    }
    const ready = await listTakas(`WHERE t.status='FOLDED' AND p.quality_id=? AND pl.shade_id=? ${jwCond}`, [o.quality_id, l.shade_id, ...(jobOrder && o.job_type ? [String(o.job_type).toLowerCase()] : [])], q)
    const picked = []
    let gotM = 0
    if (needT > 0 || needM > 0) {
      for (const t of ready) {
        if (picked.length >= needT && gotM >= needM) break
        picked.push(t); gotM = r2(gotM + Number(t.sellable_m))
      }
    }
    out.push({
      order_line_id: l.id, shade_id: l.shade_id, shade_no: l.shade_no, shade_name: l.shade_name, hex: l.hex, shade_image: l.shade_image,
      pending: pend, wantT: needT, wantM: needM,
      available: { takas: ready.length, m: r2(ready.reduce((a, t) => a + Number(t.sellable_m), 0)) },
      picked, gotT: picked.length, gotM,
      short: picked.length < needT || gotM < needM,
      // covered once the ordered takas / meters of this line are reached after the give
      covered: (!(Number(l.taka_count) > 0) || Number(l.allocated) + picked.length >= Number(l.taka_count)) && (!(Number(l.meters) > 0) || r2(Number(l.allocated_m) + gotM) >= Number(l.meters)),
    })
  }
  return out
}

/** Read-only: which takas would be given for these wants. Returns {order, lines:[{pending, wantT, wantM, available, picked, gotT, gotM, short, covered, …}]}. */
export async function previewOrderAllocation(orderId, wants = null) {
  const o = await one('SELECT * FROM orders WHERE id=?', [orderId])
  if (!o) bad('Order not found')
  const lines = await all(`${OL_SQL} WHERE ol.order_id=? ORDER BY ol.id`, [orderId])
  return { order: o, lines: await planOrderAllocation(base, o, lines, wants) }
}

/** One transaction: takas → SOLD with order_id, a taka_moves row each; the order becomes DONE when every line is covered. */
export async function allocateOrderLines(id, wants) {
  return tx(async (q) => {
    const o = await q.one('SELECT * FROM orders WHERE id=?', [id])
    if (!o) bad('Order not found')
    if (wants && o.status === 'DONE') bad('This order is already completed')
    const lines = await q.all(`${OL_SQL} WHERE ol.order_id=? ORDER BY ol.id`, [id])
    const plan = await planOrderAllocation(q, o, lines, wants)
    const ids = plan.flatMap((p) => p.picked.map((t) => t.id))
    if (ids.length) {
      await updateTakas(q, ids, `status='SOLD', order_id=?`, [id], 'FOLDED')
      await insertMoves(q, ids.map((taka_id) => ({ taka_id, from_status: 'FOLDED', to_status: 'SOLD', ref_type: 'ORDER', ref_id: id, note: 'ALLOCATED TO ORDER' })))
    }
    // a line with nothing pending is fine; a line with something pending that is not covered after the give keeps the order open
    const done = plan.every((p) => (p.pending.takas <= 0 && p.pending.meters <= 0) || p.covered)
    if (done) await q.run(`UPDATE orders SET status='DONE' WHERE id=?`, [id])
    return {
      allocated: ids.length, short: plan.filter((p) => p.short).length, done,
      lines: plan.map((p) => ({ order_line_id: p.order_line_id, takas: p.gotT, meters: p.gotM, short: p.short })),
    }
  })
}

/** Auto-allocate button: the full pending amount of every line, through the same core. */
export async function allocateOrder(id) {
  const r = await allocateOrderLines(id, null)
  return { allocated: r.allocated, short: r.short }
}

export async function closeOrder(id) {
  return await run(`UPDATE orders SET status='DONE' WHERE id=?`, [id])
}

// ---------------------------------------------------------------- stock views (audit §2.10)
const acc = () => ({ takas: 0, m: 0 })
const add = (a, m) => { a.takas += 1; a.m = r2(a.m + Number(m || 0)) }

/** Finished-goods stock meters are SELLABLE meters: folded − damaged (finished-but-unfolded takas count their finished meter). */
export const INVENTORY_VIEWS = {
  godown: { label: 'Grey at our place', statuses: ['GODOWN_GREY'], meter: (t) => t.grey_meter },
  mill: { label: 'Grey at mill', statuses: ['MILL_GREY'], meter: (t) => t.grey_meter },
  dyeing: { label: 'In dyeing', statuses: ['IN_DYEING'], meter: (t) => t.grey_meter },
  finished: { label: 'Finished goods', statuses: ['FINISHED', 'FOLDED'], meter: (t) => t.sellable_m ?? t.finished_meter },
  jobwork: { label: 'FG in job work', statuses: ['JOB_WORK'], meter: (t) => t.sellable_m },
}

/** Counts/meters for the five views + reconciliation against all active takas (everything except INACTIVE_STATUSES). */
export async function inventoryCounts() {
  const rows = await all(`SELECT status, COUNT(*) AS c, ROUND(COALESCE(SUM(CASE status
      WHEN 'FOLDED' THEN COALESCE(jw_return_meter, folded_meter - COALESCE((SELECT dd.meters FROM taka_damages dd WHERE dd.taka_id=takas.id),0))
      WHEN 'JOB_WORK' THEN COALESCE(jw_return_meter, folded_meter - COALESCE((SELECT dd.meters FROM taka_damages dd WHERE dd.taka_id=takas.id),0))
      WHEN 'FINISHED' THEN finished_meter ELSE grey_meter END),0),2) AS m
    FROM takas GROUP BY status`)
  const by = Object.fromEntries(rows.map((r) => [r.status, { takas: Number(r.c), m: r2(r.m) }]))
  const views = {}
  const known = new Set(INACTIVE_STATUSES)
  for (const [k, v] of Object.entries(INVENTORY_VIEWS)) {
    views[k] = v.statuses.reduce((a, s) => { known.add(s); return { takas: a.takas + (by[s]?.takas || 0), m: r2(a.m + (by[s]?.m || 0)) } }, { takas: 0, m: 0 })
  }
  const active = rows.filter((r) => !INACTIVE_STATUSES.includes(r.status)).reduce((s, r) => s + Number(r.c), 0)
  const other = rows.filter((r) => !known.has(r.status)).reduce((s, r) => s + Number(r.c), 0)
  const sum = Object.values(views).reduce((s, v) => s + v.takas, 0)
  return { views, active, sold: by.SOLD?.takas || 0, inactive: INACTIVE_STATUSES.reduce((s, k) => s + (by[k]?.takas || 0), 0), other, sum, reconciled: sum === active && other === 0 }
}

/** Grey in our godowns, branch by branch: [{id,name,takas,m}]. */
export async function godownByBranch() {
  const rows = await all(`SELECT t.branch_id AS id, COALESCE(b.name, 'No branch') AS name, COUNT(*) AS c, ROUND(COALESCE(SUM(t.grey_meter),0),2) AS m
    FROM takas t LEFT JOIN branches b ON b.id=t.branch_id WHERE t.status='GODOWN_GREY' GROUP BY t.branch_id, b.name ORDER BY b.name`)
  return rows.map((r) => ({ id: r.id, name: r.name, takas: Number(r.c), m: r2(r.m) }))
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
/** Default payment reminder for every order (an order can have its own days). */
export const DEFAULT_PAYMENT_DAYS = 60
export async function getPaymentDays() {
  const v = Number(await getSetting('payment_reminder_days'))
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : DEFAULT_PAYMENT_DAYS
}
export async function setPaymentDays(days) {
  const n = Number(days)
  if (!Number.isInteger(n) || n < 1 || n > 3650) bad('Enter a whole number of days between 1 and 3650')
  await setSetting('payment_reminder_days', n)
  return n
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

/** Takas of one view. filters: quality_id, group_id, weaver_id, mill_id, branch_id, shade_id, damaged, jw ('plain' | 'jobworked') */
export async function inventoryList(view, f = {}) {
  const v = INVENTORY_VIEWS[view]
  if (!v) bad('Unknown stock view')
  const where = [`t.status IN (${qs(v.statuses)})`], args = [...v.statuses]
  const add1 = (cond, val) => { if (val !== undefined && val !== null && val !== '') { where.push(cond); args.push(val) } }
  add1('p.quality_id=?', f.quality_id); add1('g.id=?', f.group_id); add1('r.weaver_id=?', f.weaver_id)
  add1('t.mill_id=?', f.mill_id); add1('t.branch_id=?', f.branch_id); add1('pl.shade_id=?', f.shade_id)
  if (f.damaged) where.push('dm.id IS NOT NULL')
  if (f.jw === 'plain') where.push('t.jw_type IS NULL')
  if (f.jw === 'jobworked') where.push('t.jw_type IS NOT NULL')
  const takas = await listTakas(`WHERE ${where.join(' AND ')}`, args)
  return takas.map((t) => ({ ...t, stock_m: Number(v.meter(t) ?? 0) }))
}

/** Footer total of the damaged-meters column: the sum of damage_m of the rows (never the stock meters). */
export const damagedTotal = (rows) => r2((rows || []).reduce((s, t) => s + Number(t.damage_m || 0), 0))

/**
 * Damaged stock = takas across ANY stage that have a taka_damages record.
 * Returns listTakas rows with `stock_m` = damage_m (so aggregate meters = total damaged meters).
 * Optional filter: quality_id.
 */
export async function damagedStock(f = {}) {
  const where = ['dm.id IS NOT NULL'], args = []
  if (f.quality_id) { where.push('p.quality_id=?'); args.push(f.quality_id) }
  if (f.group_id) { where.push('g.id=?'); args.push(f.group_id) }
  if (f.weaver_id) { where.push('r.weaver_id=?'); args.push(f.weaver_id) }
  if (f.shade_id) { where.push('pl.shade_id=?'); args.push(f.shade_id) }
  const takas = await listTakas(`WHERE ${where.join(' AND ')}`, args)
  return takas.map((t) => ({ ...t, stock_m: Number(t.damage_m ?? 0) }))
}

/**
 * Availability for a customer order (R-SO-1): for one quality (by nickname) and each requested colour. Grey stock has no colour
 * yet, so it is reported once for the quality (grey at our place by branch). `openPos` = POs of the quality that are Open or
 * Partly received: their count and total pending meters.
 */
export async function availabilityDetail(qualityId, shadeIds = []) {
  const [takas, shades, pos] = await Promise.all([
    listTakas(`WHERE p.quality_id=? AND ${NOT_INACTIVE()}`, [qualityId]),
    all(`SELECT s.* FROM shades s ${shadeIds.length ? `WHERE s.id IN (${qs(shadeIds)})` : 'WHERE 0'}`, shadeIds),
    listPOs(),
  ])
  const group = (arr, keyOf, labelOf) => {
    const m = new Map()
    for (const [t, mt] of arr) { const k = keyOf(t); if (!m.has(k)) m.set(k, { label: labelOf(t), ...acc() }); add(m.get(k), mt) }
    return [...m.values()]
  }
  const mill = takas.filter((t) => t.status === 'MILL_GREY')
  const place = takas.filter((t) => t.status === 'GODOWN_GREY')
  const open = pos.filter((p) => Number(p.quality_id) === Number(qualityId) && (p.status === 'OPEN' || p.status === 'PARTIAL'))
  const out = {
    greyAtMill: { ...acc(), byMill: group(mill.map((t) => [t, t.grey_meter]), (t) => t.mill_id, (t) => t.mill_name || '—') },
    greyAtPlace: { ...acc(), byBranch: group(place.map((t) => [t, t.grey_meter]), (t) => t.branch_id ?? 'none', (t) => t.branch_name || 'No branch') },
    openPos: { count: open.length, pending_m: r2(open.reduce((s, p) => s + p.pending_m, 0)) },
    shades: [],
  }
  mill.forEach((t) => add(out.greyAtMill, t.grey_meter))
  place.forEach((t) => add(out.greyAtPlace, t.grey_meter))
  for (const sd of shades) {
    const mine = takas.filter((t) => t.shade_id === sd.id)
    const fin = mine.filter((t) => t.status === 'FINISHED' || t.status === 'FOLDED')
    const dye = mine.filter((t) => t.status === 'IN_DYEING')
    const s = { shade_id: sd.id, shade_no: sd.number, shade_name: sd.name, hex: sd.hex, image_url: sd.image_url, finished: acc(), folded: acc(), unfolded: acc(), plain: acc(), jobworked: acc(), jobTypes: [], atJobWorker: acc(), dyeing: acc(), programs: [] }
    fin.forEach((t) => {
      const m = t.sellable_m ?? t.finished_meter
      add(s.finished, m); add(t.status === 'FOLDED' ? s.folded : s.unfolded, m)
      if (t.status === 'FOLDED') add(t.jw_type == null ? s.plain : s.jobworked, m)
    })
    s.jobTypes = group(fin.filter((t) => t.status === 'FOLDED' && t.jw_type != null).map((t) => [t, t.sellable_m]), (t) => String(t.jw_type).toLowerCase(), (t) => t.jw_type)
    mine.filter((t) => t.status === 'JOB_WORK').forEach((t) => add(s.atJobWorker, t.sellable_m))
    s.lots = group(fin.filter((t) => t.lot_no).map((t) => [t, t.sellable_m ?? t.finished_meter]), (t) => t.lot_no, (t) => t.lot_no).map((g) => ({ lot: g.label, takas: g.takas, m: g.m }))
    dye.forEach((t) => add(s.dyeing, t.grey_meter))
    s.programs = group(dye.map((t) => [t, t.grey_meter]), (t) => t.program_id, (t) => `${t.program_no} · ${t.program_mill_name}`)
    s.programs.forEach((g, i) => { g.lots = [...new Set(dye.filter((t) => `${t.program_no} · ${t.program_mill_name}` === g.label && t.line_lot_no).map((t) => t.line_lot_no))] })
    s.jwChallans = [...new Set(mine.filter((t) => t.status === 'JOB_WORK' && t.jw_no).map((t) => t.jw_no))]
    out.shades.push(s)
  }
  return out
}

/**
 * Order detail (R-SO-5): the stock picture of one order — availabilityDetail for its quality and colours plus, per line,
 * the pending amount, the ELIGIBLE ready stock (plain for a normal order, job-worked of the named type for a job-work order)
 * and "short by" / "covered". Returns {order, jobOrder, detail, lines:[{line_id, shade_id, pending, eligible, shortT, shortM, covered}]}.
 */
export async function orderAvailability(orderId) {
  const o = await one('SELECT * FROM orders WHERE id=?', [orderId])
  if (!o) bad('Order not found')
  const lines = await all(`${OL_SQL} WHERE ol.order_id=? ORDER BY ol.id`, [orderId])
  const detail = await availabilityDetail(o.quality_id, lines.map((l) => l.shade_id))
  const jobOrder = Number(o.job_work) === 1
  const type = o.job_type ? String(o.job_type).toLowerCase() : null
  const ready = (await listTakas(`WHERE t.status='FOLDED' AND p.quality_id=?`, [o.quality_id]))
    .filter((t) => (jobOrder ? t.jw_type != null && (!type || String(t.jw_type).toLowerCase() === type) : t.jw_type == null))
  return {
    order: o, jobOrder, detail,
    lines: lines.map((l) => {
      const pending = pendingOf(l)
      const mine = ready.filter((t) => Number(t.shade_id) === Number(l.shade_id))
      const eligible = { takas: mine.length, m: r2(mine.reduce((a, t) => a + Number(t.sellable_m), 0)) }
      const shortT = Math.max(0, pending.takas - eligible.takas)
      const shortM = Math.max(0, r2(pending.meters - eligible.m))
      return { line_id: l.id, shade_id: l.shade_id, pending, eligible, shortT, shortM, done: orderLineDone(l), covered: shortT === 0 && shortM === 0 }
    }),
  }
}

/**
 * Folding → In mill (R-FD-5): programs that still have takas in dyeing, grouped by mill:
 * [{mill_id, mill_name, programs:[{id, program_no, date, days, qualities, lines, colours:[{shade_id, shade_no, hex, shade_image, takas}],
 *   issued, received, pending, pending_m, lots, challans}]}]. `nowMs` is injectable for tests.
 */
export async function inMillPrograms(nowMs = Date.now()) {
  const [progs, dyeing] = await Promise.all([listPrograms(), listTakas(`WHERE t.status='IN_DYEING'`)])
  const byProgram = new Map()
  for (const t of dyeing) { if (!byProgram.has(t.program_id)) byProgram.set(t.program_id, []); byProgram.get(t.program_id).push(t) }
  const mills = new Map()
  for (const pr of progs) {
    const pend = byProgram.get(pr.id)
    if (!pend?.length) continue
    const colours = new Map()
    for (const t of pend) {
      if (!colours.has(t.shade_id)) colours.set(t.shade_id, { shade_id: t.shade_id, shade_no: t.shade_no, hex: t.shade_hex, shade_image: t.shade_image, takas: 0 })
      colours.get(t.shade_id).takas += 1
    }
    const row = {
      id: pr.id, program_no: pr.program_no, date: pr.date, notes: pr.notes,
      days: Math.max(0, Math.floor((nowMs - new Date(`${pr.date}T00:00:00`).getTime()) / 864e5)),
      qualities: String(pr.nick_name || '').split(',').filter(Boolean),
      colours: [...colours.values()],
      issued: Number(pr.total_takas), received: Number(pr.received_takas), pending: pend.length,
      pending_m: r2(pend.reduce((a, t) => a + Number(t.grey_meter), 0)),
      lots: [...new Set(pr.lines.map((l) => l.lot_no).filter(Boolean))],
      challans: [...new Set(pr.lines.map((l) => l.weaver_challan).filter(Boolean))],
    }
    if (!mills.has(pr.mill_id)) mills.set(pr.mill_id, { mill_id: pr.mill_id, mill_name: pr.mill_name, programs: [] })
    mills.get(pr.mill_id).programs.push(row)
  }
  return [...mills.values()].sort((a, b) => String(a.mill_name).localeCompare(String(b.mill_name)))
    .map((m) => ({ ...m, programs: m.programs.sort((a, b) => b.days - a.days) }))
}

/** Older, compact stock position kept for compatibility. */
export async function availability(qualityId) {
  const takas = await listTakas(`WHERE p.quality_id=? AND ${NOT_INACTIVE()}`, [qualityId])
  const res = { godownGrey: acc(), millGrey: acc(), dyeing: acc(), finished: acc(), ready: acc(), byShade: {} }
  for (const t of takas) {
    if (t.status === 'GODOWN_GREY') add(res.godownGrey, t.grey_meter)
    if (t.status === 'MILL_GREY') add(res.millGrey, t.grey_meter)
    if (t.shade_id) {
      const s = (res.byShade[t.shade_id] ||= { shade_id: t.shade_id, shade_no: t.shade_no, hex: t.shade_hex, dyeing: acc(), finished: acc(), ready: acc() })
      if (t.status === 'IN_DYEING') { add(s.dyeing, t.grey_meter); add(res.dyeing, t.grey_meter) }
      if (t.status === 'FINISHED') { add(s.finished, t.finished_meter); add(res.finished, t.finished_meter) }
      if (t.status === 'FOLDED') { add(s.ready, t.sellable_m); add(res.ready, t.sellable_m) }
    }
  }
  return res
}

// ---------------------------------------------------------------- shrinkage report (R-SH-1..3)
// Shortage is measured only at the mill (grey − finished) and at folding (finished − folded). Damage is reported separately.
function summarize(rows, keyOf, labelOf, extra = () => ({})) {
  const m = new Map()
  for (const t of rows) {
    const k = keyOf(t)
    if (!m.has(k)) m.set(k, { key: k, label: labelOf(t), takas: 0, start: 0, finished: 0, folded: 0, foldedTakas: 0, foldedGrey: 0, millShortage: 0, foldShortage: 0, totalShortage: 0, damage: 0, damagedTakas: 0, jwShortage: 0, ...extra(t) })
    const g = m.get(k)
    g.takas += 1
    g.start += t.grey
    g.finished += t.finished_meter != null ? Number(t.finished_meter) : 0
    g.millShortage += t.millShortage ?? 0
    g.totalShortage += t.totalShortage ?? 0
    if (t.folded_meter != null) { g.folded += Number(t.folded_meter); g.foldedTakas += 1; g.foldedGrey += t.grey; g.foldShortage += t.foldShortage ?? 0 }
    if (t.damage != null) { g.damage += t.damage; g.damagedTakas += 1 }
    if (t.jwShortage != null) g.jwShortage += t.jwShortage
  }
  const pct = (v, b) => (b ? r2((v / b) * 100) : null)
  return [...m.values()].map((g) => ({
    ...g,
    start: r2(g.start), finished: r2(g.finished), folded: r2(g.folded), foldedGrey: r2(g.foldedGrey),
    millShortage: r2(g.millShortage), foldShortage: r2(g.foldShortage), totalShortage: r2(g.totalShortage), damage: r2(g.damage), jwShortage: r2(g.jwShortage),
    millPct: pct(g.millShortage, g.start), foldPct: pct(g.foldShortage, g.foldedGrey), totalPct: pct(g.totalShortage, g.start),
  }))
}

/** Per-taka chains for every taka that came back from the mill, plus summaries by PO/party/quality/mill/program. */
export async function shrinkageReport() {
  const [takas, pos] = await Promise.all([listTakas('WHERE t.finished_meter IS NOT NULL'), listPOs()])
  const poById = new Map(pos.map((p) => [p.id, p]))
  const byPo = summarize(takas, (t) => t.po_id, (t) => t.po_no).map((g) => ({ ...g, po: poById.get(g.key) }))
  for (const p of pos) {
    if (!byPo.some((g) => g.key === p.id) && p.received_m > 0) {
      byPo.push({ key: p.id, label: p.po_no, takas: 0, start: 0, finished: 0, folded: 0, foldedTakas: 0, foldedGrey: 0, millShortage: 0, foldShortage: 0, totalShortage: 0, damage: 0, damagedTakas: 0, jwShortage: 0, millPct: null, foldPct: null, totalPct: null, po: p })
    }
  }
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
    all(`SELECT status, COUNT(*) AS c, COALESCE(SUM(CASE status
      WHEN 'FOLDED' THEN COALESCE(jw_return_meter, folded_meter - COALESCE((SELECT dd.meters FROM taka_damages dd WHERE dd.taka_id=takas.id),0))
      WHEN 'JOB_WORK' THEN COALESCE(jw_return_meter, folded_meter - COALESCE((SELECT dd.meters FROM taka_damages dd WHERE dd.taka_id=takas.id),0))
      WHEN 'SOLD' THEN COALESCE(folded_meter, finished_meter, grey_meter)
      ELSE COALESCE(finished_meter, grey_meter) END),0) AS m FROM takas GROUP BY status`),
    listPOs(),
    listTakas(`WHERE t.folded_meter IS NOT NULL`),
    listReceipts(), listMillChallans(), listPrograms(), listFinishedReceipts(), listOrders(),
  ])
  const status = Object.fromEntries(PIPELINE.map((s) => [s, { c: 0, m: 0 }]))
  byStatus.forEach((r) => { status[r.status] = { c: Number(r.c), m: r2(r.m) } })
  const openPos = pos.filter((p) => p.status === 'OPEN' || p.status === 'PARTIAL')
  const avg = (arr) => (arr.length ? r2(arr.reduce((s, v) => s + v, 0) / arr.length) : 0)
  const activity = [
    ...receipts.slice(0, 5).map((r) => ({ kind: 'receipt', date: r.date, title: `Grey challan ${r.challan_no}`, sub: `${r.weaver_name} · ${r.taka_count} taka · ${r.nick_name}`, to: `/receipts/${r.id}` })),
    ...dispatches.slice(0, 5).map((d) => ({ kind: 'dispatch', date: d.date, title: d.kind === 'main' ? `Mill challan ${d.main_no} sent to mill` : `${d.label} sent to mill`, sub: `${d.mill_name} · ${d.taka_count} taka`, to: d.kind === 'main' ? `/dispatch/${d.id}` : `/dispatch/old/${d.id}` })),
    ...programs.slice(0, 5).map((p) => ({ kind: 'program', date: p.date, title: `Program ${p.program_no}`, sub: `${p.mill_name} · ${p.nick_name} · ${p.total_takas} taka`, to: `/programs/${p.id}` })),
    ...finished.slice(0, 5).map((f) => ({ kind: 'finished', date: f.date, title: `Finished challan ${f.challan_no}`, sub: `${f.program_no} · ${f.taka_count} taka`, to: `/programs/${f.program_id}` })),
    ...orders.slice(0, 5).map((o) => ({ kind: 'order', date: o.date, title: `Order ${o.order_no}`, sub: `${o.customer_name} · ${o.nick_name} · ${o.total_takas} taka`, to: `/orders/${o.id}` })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8)
  return {
    status,
    openPoCount: openPos.length,
    pendingPoM: r2(openPos.reduce((s, p) => s + p.pending_m, 0)),
    shortage: {
      mill: avg(folded.map((t) => t.millPct).filter((v) => v != null)),
      fold: avg(folded.map((t) => t.foldPct).filter((v) => v != null)),
      total: avg(folded.map((t) => t.totalPct).filter((v) => v != null)),
      count: folded.length,
    },
    openOrders: orders.filter((o) => o.status === 'OPEN').length,
    paymentsDue: { count: orders.filter((o) => o.payment.due).length, amount: r2(orders.filter((o) => o.payment.due).reduce((s, o) => s + (o.payment.outstanding || 0), 0)) },
    activity,
  }
}

// ---------------------------------------------------------------- finished goods: picking stock for job work / withdrawals (client changes 2)
// The SYSTEM picks the takas (oldest folded first, then taka id): whole takas until both the taka count and the meters are
// reached; the last taka may overshoot the meters because takas are never cut. Plain = never job-worked (jw_type NULL).
const FG_PICK_SQL = `SELECT t.id, t.taka_no, t.folded_on, t.jw_type, t.jw_challan_id, r.challan_no, p.quality_id, pl.shade_id,
  ROUND(COALESCE(t.jw_return_meter, t.folded_meter - COALESCE(dm.meters,0)),2) AS m
  FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id
  JOIN program_lines pl ON pl.id=t.program_line_id LEFT JOIN taka_damages dm ON dm.taka_id=t.id`

/**
 * lines: [{quality_id, shade_id, takas?, meters?, kind?: 'plain' | 'jobworked'}]. Returns [{quality_id, shade_id, kind, takas, m, picks:[{id,label,m}]}].
 * Never picks the same taka twice across lines. `jobworkedAllowed` = false → only plain stock may be asked for.
 */
async function pickFg(q, rawLines, { jobworkedAllowed }) {
  if (!rawLines?.length) bad('Add at least one line')
  const taken = new Set(), out = []
  for (const [i, l] of rawLines.entries()) {
    const no = `Line ${i + 1}`
    const quality_id = Number(l.quality_id), shade_id = Number(l.shade_id)
    if (!quality_id || !shade_id) bad(`${no}: choose the quality and the colour`)
    const wantT = l.takas === '' || l.takas == null ? 0 : Number(l.takas)
    if (!Number.isInteger(wantT) || wantT < 0) bad(`${no}: takas must be a whole number`)
    const wantM = l.meters === '' || l.meters == null || Number(l.meters) === 0 ? 0 : meters2(l.meters, `${no} meters`)
    if (!wantT && !wantM) bad(`${no}: enter the takas and/or the meters wanted`)
    const kind = l.kind === 'jobworked' ? 'jobworked' : 'plain'
    if (kind === 'jobworked' && !jobworkedAllowed) bad(`${no}: only plain (not job-worked) stock can be used here`)
    const stock = await q.all(
      `${FG_PICK_SQL} WHERE t.status='FOLDED' AND p.quality_id=? AND pl.shade_id=? AND t.jw_type IS ${kind === 'plain' ? '' : 'NOT '}NULL ORDER BY COALESCE(t.folded_on,''), t.id`,
      [quality_id, shade_id])
    const free = stock.filter((t) => !taken.has(Number(t.id)))
    const picks = []
    let gotM = 0
    for (const t of free) {
      if (picks.length >= wantT && gotM >= wantM) break
      picks.push({ id: Number(t.id), label: `${t.challan_no}/${t.taka_no}`, m: Number(t.m), jw_type: t.jw_type, folded_on: t.folded_on })
      taken.add(Number(t.id)); gotM = r2(gotM + Number(t.m))
    }
    if (picks.length < wantT || gotM < wantM) {
      const have = { t: free.length, m: r2(free.reduce((s, t) => s + Number(t.m), 0)) }
      bad(`${no}: not enough ${kind === 'plain' ? 'plain' : 'job-worked'} stock — wanted ${wantT ? `${wantT} taka` : ''}${wantT && wantM ? ' / ' : ''}${wantM ? `${wantM} m` : ''}, only ${have.t} taka · ${have.m} m available`)
    }
    out.push({ quality_id, shade_id, kind, takas: picks.length, m: gotM, picks })
  }
  return out
}
/** Read-only preview of what the system would pick for these lines (the save repeats the pick inside its transaction). */
export const previewFgPick = (lines, { jobworkedAllowed = false } = {}) => pickFg(base, lines, { jobworkedAllowed })

/** Folded stock per quality + colour, split plain / job-worked: the "available" figures next to each line of the forms. */
export async function listFgStock() {
  const rows = await all(`SELECT p.quality_id, q.nick_name, pl.shade_id, s.number AS shade_no, s.name AS shade_name, s.hex, s.image_url,
    SUM(CASE WHEN t.jw_type IS NULL THEN 1 ELSE 0 END) AS plain_takas,
    ROUND(SUM(CASE WHEN t.jw_type IS NULL THEN COALESCE(t.jw_return_meter, t.folded_meter - COALESCE(dm.meters,0)) ELSE 0 END),2) AS plain_m,
    SUM(CASE WHEN t.jw_type IS NOT NULL THEN 1 ELSE 0 END) AS jw_takas,
    ROUND(SUM(CASE WHEN t.jw_type IS NOT NULL THEN COALESCE(t.jw_return_meter, t.folded_meter - COALESCE(dm.meters,0)) ELSE 0 END),2) AS jw_m
    FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id
    JOIN program_lines pl ON pl.id=t.program_line_id JOIN shades s ON s.id=pl.shade_id LEFT JOIN taka_damages dm ON dm.taka_id=t.id
    WHERE t.status='FOLDED'
    GROUP BY p.quality_id, q.nick_name, pl.shade_id, s.number, s.name, s.hex, s.image_url
    ORDER BY q.nick_name, s.number`)
  return rows.map((r) => ({ ...r, plain_takas: Number(r.plain_takas), plain_m: r2(r.plain_m), jw_takas: Number(r.jw_takas), jw_m: r2(r.jw_m) }))
}

// ---------------------------------------------------------------- job work (R-JW)
export const JW_STATUS_META = {
  OPEN: { label: 'Open', variant: 'primary' },
  PARTIAL: { label: 'Partly received', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CLOSED: { label: 'Closed (short)', variant: 'danger' },
}
const JWT_SUM = (cond, col) => `(SELECT ROUND(COALESCE(SUM(${col}),0),2) FROM job_work_takas j WHERE j.challan_id=c.id${cond ? ` AND j.status='${cond}'` : ''})`
const JWT_CNT = (cond) => `(SELECT COUNT(*) FROM job_work_takas j WHERE j.challan_id=c.id${cond ? ` AND j.status='${cond}'` : ''})`
const JW_SQL = `SELECT c.*, w.name AS worker_name, w.gstin AS worker_gstin, w.phone AS worker_phone, w.city AS worker_city, o.order_no, cu.name AS order_customer,
  ${JWT_CNT()} AS sent_takas, ${JWT_SUM('', 'j.sent_m')} AS sent_m,
  ${JWT_CNT('RECEIVED')} AS received_takas, ${JWT_SUM('RECEIVED', 'j.received_m')} AS received_m, ${JWT_SUM('RECEIVED', 'j.sent_m')} AS received_sent_m,
  ${JWT_CNT('SENT')} AS pending_takas, ${JWT_SUM('SENT', 'j.sent_m')} AS pending_m,
  ${JWT_CNT('NOT_RETURNED')} AS lost_takas, ${JWT_SUM('NOT_RETURNED', 'j.sent_m')} AS lost_m,
  (SELECT GROUP_CONCAT(DISTINCT q.nick_name) FROM job_work_takas j JOIN qualities q ON q.id=j.quality_id WHERE j.challan_id=c.id) AS qualities
  FROM job_work_challans c JOIN job_workers w ON w.id=c.job_worker_id LEFT JOIN orders o ON o.id=c.order_id LEFT JOIN customers cu ON cu.id=o.customer_id`
const decorateJw = (c, nowMs = Date.now()) => ({
  ...c, jw_label: `JW-${c.jw_no}`,
  // job work shortage = sent − received on the takas that came back (not-returned takas are shown separately)
  shortage_m: r2(Number(c.received_sent_m) - Number(c.received_m)),
  days_out: (c.status === 'OPEN' || c.status === 'PARTIAL') && c.date ? Math.max(0, Math.floor((nowMs - new Date(`${c.date}T00:00:00Z`).getTime()) / 864e5)) : null,
})
export async function listJobWorks(where = '', args = []) {
  return (await all(`${JW_SQL} ${where} ORDER BY c.date DESC, c.id DESC`, args)).map((c) => decorateJw(c))
}
/** Earlier job types (challans + orders) for the suggestion list of the free-text "job type" field. */
export async function jobTypeSuggestions() {
  const rows = await all(`SELECT job_type AS t FROM job_work_challans WHERE job_type IS NOT NULL UNION SELECT job_type FROM orders WHERE job_type IS NOT NULL UNION SELECT jw_type FROM takas WHERE jw_type IS NOT NULL ORDER BY 1`)
  return rows.map((r) => r.t).filter((t) => t && t !== 'Job work')
}
export async function getJobWork(id) {
  const c = await one(`${JW_SQL} WHERE c.id=?`, [id])
  if (!c) return null
  const [lines, receipts, takas] = await Promise.all([
    all(`SELECT j.quality_id, j.shade_id, q.nick_name, s.number AS shade_no, s.name AS shade_name, s.hex, s.image_url,
      COUNT(*) AS sent_takas, ROUND(SUM(j.sent_m),2) AS sent_m,
      SUM(CASE WHEN j.status='RECEIVED' THEN 1 ELSE 0 END) AS received_takas,
      ROUND(SUM(CASE WHEN j.status='RECEIVED' THEN j.received_m ELSE 0 END),2) AS received_m,
      ROUND(SUM(CASE WHEN j.status='RECEIVED' THEN j.sent_m ELSE 0 END),2) AS received_sent_m,
      SUM(CASE WHEN j.status='SENT' THEN 1 ELSE 0 END) AS pending_takas,
      ROUND(SUM(CASE WHEN j.status='SENT' THEN j.sent_m ELSE 0 END),2) AS pending_m,
      SUM(CASE WHEN j.status='NOT_RETURNED' THEN 1 ELSE 0 END) AS lost_takas
      FROM job_work_takas j JOIN qualities q ON q.id=j.quality_id JOIN shades s ON s.id=j.shade_id WHERE j.challan_id=?
      GROUP BY j.quality_id, j.shade_id, q.nick_name, s.number, s.name, s.hex, s.image_url ORDER BY q.nick_name, s.number`, [id]),
    all(`SELECT rc.*, (SELECT COUNT(*) FROM job_work_takas j WHERE j.receipt_id=rc.id) AS takas,
      (SELECT ROUND(COALESCE(SUM(j.received_m),0),2) FROM job_work_takas j WHERE j.receipt_id=rc.id) AS meters,
      (SELECT ROUND(COALESCE(SUM(j.sent_m),0),2) FROM job_work_takas j WHERE j.receipt_id=rc.id) AS sent_m
      FROM job_work_receipts rc WHERE rc.challan_id=? ORDER BY rc.id`, [id]),
    all(`SELECT j.*, t.taka_no, t.lot_no, t.status AS taka_status, r.challan_no, q.nick_name, s.number AS shade_no, s.name AS shade_name, s.hex AS shade_hex, s.image_url AS shade_image, rc.date AS receipt_date
      FROM job_work_takas j JOIN takas t ON t.id=j.taka_id JOIN grey_receipts r ON r.id=t.receipt_id
      LEFT JOIN qualities q ON q.id=j.quality_id LEFT JOIN shades s ON s.id=j.shade_id LEFT JOIN job_work_receipts rc ON rc.id=j.receipt_id
      WHERE j.challan_id=? ORDER BY j.id`, [id]),
  ])
  const num2 = (l) => ({ ...l, sent_takas: Number(l.sent_takas), received_takas: Number(l.received_takas), pending_takas: Number(l.pending_takas), lost_takas: Number(l.lost_takas), shortage_m: r2(Number(l.received_sent_m) - Number(l.received_m)) })
  return { ...decorateJw(c), lines: lines.map(num2), receipts, takas: takas.map((t) => ({ ...t, label: `${t.challan_no}/${t.taka_no}`, shortage_m: t.status === 'RECEIVED' ? r2(Number(t.sent_m) - Number(t.received_m)) : null })) }
}

async function requireLinkableOrder(q, orderId) {
  const o = await q.one('SELECT id, job_work, status, order_no FROM orders WHERE id=?', [orderId])
  if (!o) bad('Order not found')
  if (Number(o.job_work) !== 1) bad(`Order ${o.order_no} does not need job work — switch "Job work required" on in the order first`)
  if (o.status !== 'OPEN') bad(`Order ${o.order_no} is closed — only open orders can be linked`)
}

/**
 * Withdraw plain FOLDED takas to a job worker. d: {job_worker_id, job_type?, date, notes?, order_id?, lines:[{quality_id, shade_id, takas?, meters?}]}.
 * One transaction: pick → challan JW-n → takas JOB_WORK. Returns the challan id.
 */
export async function createJobWork({ job_worker_id, job_type, date, notes, order_id, lines }) {
  if (!job_worker_id) bad('Choose the job worker')
  if (!date) bad('Date is required')
  return tx(async (q) => {
    if (!(await q.one('SELECT id FROM job_workers WHERE id=?', [job_worker_id]))) bad('Job worker not found')
    if (order_id) await requireLinkableOrder(q, order_id)
    const picked = await pickFg(q, lines, { jobworkedAllowed: false })
    const ids = picked.flatMap((l) => l.picks.map((t) => t.id))
    await requireTakas(q, ids, 'FOLDED', 'send to job work')
    assertMove('FOLDED', 'JOB_WORK')
    const no = Number((await q.one('SELECT COALESCE(MAX(jw_no),0)+1 AS n FROM job_work_challans')).n)
    const { lastId } = await q.run(
      `INSERT INTO job_work_challans (jw_no,date,job_worker_id,job_type,order_id,notes,status,created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [no, date, job_worker_id, String(job_type ?? '').trim() || null, order_id || null, String(notes ?? '').trim() || null, 'OPEN', nowIso()])
    const rows = picked.flatMap((l) => l.picks.map((t) => ({ ...t, quality_id: l.quality_id, shade_id: l.shade_id })))
    for (const part of chunks(rows, ROWS)) {
      await q.run(`INSERT INTO job_work_takas (challan_id,taka_id,quality_id,shade_id,sent_m,status) VALUES ${part.map(() => '(?,?,?,?,?,?)').join(',')}`,
        part.flatMap((t) => [lastId, t.id, t.quality_id, t.shade_id, t.m, 'SENT']))
    }
    await updateTakas(q, ids, `status='JOB_WORK', jw_challan_id=?`, [lastId], 'FOLDED')
    await insertMoves(q, ids.map((taka_id) => ({ taka_id, from_status: 'FOLDED', to_status: 'JOB_WORK', ref_type: 'JOB_WORK', ref_id: lastId, note: `SENT TO JOB WORKER (JW-${no})` })))
    return lastId
  })
}

/**
 * Receive takas back from the job worker. d: {date, ref_no?, notes?, rows:[{taka_id, received_m}]}; partial receipts any number of times.
 * Received takas return to FOLDED (same quality + colour), marked job-worked (jw_type), their sellable meters = the received meters.
 */
export async function receiveJobWork(challanId, { date, ref_no, notes, rows }) {
  if (!rows?.length) bad('Select the takas that came back')
  if (!date) bad('Receipt date is required')
  const clean = rows.map((r) => ({ taka_id: Number(r.taka_id), received: meters2(r.received_m, 'Received meters') }))
  return tx(async (q) => {
    const c = await q.one('SELECT * FROM job_work_challans WHERE id=?', [challanId])
    if (!c) bad('Job work challan not found')
    if (c.status === 'CLOSED') bad('This challan is closed (short) — re-open it before receiving more')
    if (c.status === 'COMPLETED') bad('Everything was already received on this challan')
    await requireTakas(q, clean.map((r) => r.taka_id), 'JOB_WORK', 'receive from job work')
    const jwt = []
    for (const part of chunks(clean.map((r) => r.taka_id), 400)) {
      jwt.push(...(await q.all(`SELECT id, taka_id, sent_m FROM job_work_takas WHERE challan_id=? AND status='SENT' AND taka_id IN (${qs(part)})`, [challanId, ...part])))
    }
    if (jwt.length !== clean.length) bad('Some selected takas are not pending on this challan')
    const sentOf = new Map(jwt.map((j) => [Number(j.taka_id), j]))
    const rowsJ = clean.map((r) => ({ ...r, jwt_id: Number(sentOf.get(r.taka_id).id), sent: Number(sentOf.get(r.taka_id).sent_m) }))
    for (const r of rowsJ) if (r.received > r.sent) bad(`Received meters (${r.received}) cannot be more than the ${r.sent} m that were sent`)
    const { lastId } = await q.run('INSERT INTO job_work_receipts (challan_id,date,ref_no,notes,created_at) VALUES (?,?,?,?,?)',
      [challanId, date, String(ref_no ?? '').trim() || null, String(notes ?? '').trim() || null, nowIso()])
    for (const part of chunks(rowsJ, ROWS)) {
      const cw = caseWhen(part.map((r) => ({ id: r.jwt_id, received: r.received })), (r) => r.received)
      const res = await q.run(`UPDATE job_work_takas SET status='RECEIVED', receipt_id=?, received_m=${cw.sql} WHERE id IN (${qs(part)}) AND status='SENT'`,
        [lastId, ...cw.args, ...part.map((r) => r.jwt_id)])
      if (res.changes !== part.length) bad(SAVE_RACE)
    }
    assertMove('JOB_WORK', 'FOLDED')
    await updateTakasEach(q, rowsJ.map((r) => ({ id: r.taka_id, received: r.received })), `status='FOLDED', jw_type=?, jw_challan_id=?`, [c.job_type || 'Job work', challanId],
      { jw_return_meter: (r) => r.received }, 'JOB_WORK')
    await insertMoves(q, rowsJ.map((r) => ({ taka_id: r.taka_id, from_status: 'JOB_WORK', to_status: 'FOLDED', ref_type: 'JOB_WORK_RECEIPT', ref_id: lastId, note: `RECEIVED FROM JOB WORKER (JW-${c.jw_no}) ${r.received} m` })))
    const pending = Number((await q.one(`SELECT COUNT(*) AS c FROM job_work_takas WHERE challan_id=? AND status='SENT'`, [challanId])).c)
    await q.run('UPDATE job_work_challans SET status=? WHERE id=?', [pending === 0 ? 'COMPLETED' : 'PARTIAL', challanId])
    return lastId
  })
}

/** Close a challan while takas are still pending: they become NOT_RETURNED (no longer stock). A reason is required. */
export async function closeJobWork(challanId, reason) {
  const why = String(reason ?? '').trim()
  if (!why) bad('Give the reason for closing this challan short')
  return tx(async (q) => {
    const c = await q.one('SELECT * FROM job_work_challans WHERE id=?', [challanId])
    if (!c) bad('Job work challan not found')
    if (c.status === 'CLOSED') bad('This challan is already closed')
    if (c.status === 'COMPLETED') bad('Everything was received — there is nothing to close short')
    const pend = (await q.all(`SELECT taka_id FROM job_work_takas WHERE challan_id=? AND status='SENT'`, [challanId])).map((r) => Number(r.taka_id))
    if (!pend.length) bad('No takas are pending on this challan')
    assertMove('JOB_WORK', 'NOT_RETURNED')
    await requireTakas(q, pend, 'JOB_WORK', 'close the challan')
    await updateTakas(q, pend, `status='NOT_RETURNED'`, [], 'JOB_WORK')
    for (const part of chunks(pend, 400)) await q.run(`UPDATE job_work_takas SET status='NOT_RETURNED' WHERE challan_id=? AND status='SENT' AND taka_id IN (${qs(part)})`, [challanId, ...part])
    await insertMoves(q, pend.map((taka_id) => ({ taka_id, from_status: 'JOB_WORK', to_status: 'NOT_RETURNED', ref_type: 'JOB_WORK', ref_id: challanId, note: `NOT RETURNED (JW-${c.jw_no}): ${why}` })))
    await q.run(`UPDATE job_work_challans SET status='CLOSED', close_reason=?, closed_at=? WHERE id=?`, [why, nowIso(), challanId])
    return pend.length
  })
}
/** Re-open a closed challan: the not-returned takas go back to JOB_WORK. */
export async function reopenJobWork(challanId) {
  return tx(async (q) => {
    const c = await q.one('SELECT * FROM job_work_challans WHERE id=?', [challanId])
    if (!c) bad('Job work challan not found')
    if (c.status !== 'CLOSED') bad('Only a closed challan can be re-opened')
    const lost = (await q.all(`SELECT taka_id FROM job_work_takas WHERE challan_id=? AND status='NOT_RETURNED'`, [challanId])).map((r) => Number(r.taka_id))
    assertMove('NOT_RETURNED', 'JOB_WORK')
    if (lost.length) {
      await requireTakas(q, lost, 'NOT_RETURNED', 're-open the challan')
      await updateTakas(q, lost, `status='JOB_WORK'`, [], 'NOT_RETURNED')
      for (const part of chunks(lost, 400)) await q.run(`UPDATE job_work_takas SET status='SENT' WHERE challan_id=? AND status='NOT_RETURNED' AND taka_id IN (${qs(part)})`, [challanId, ...part])
      await insertMoves(q, lost.map((taka_id) => ({ taka_id, from_status: 'NOT_RETURNED', to_status: 'JOB_WORK', ref_type: 'JOB_WORK', ref_id: challanId, note: `CHALLAN RE-OPENED (JW-${c.jw_no})` })))
    }
    const got = Number((await q.one(`SELECT COUNT(*) AS c FROM job_work_takas WHERE challan_id=? AND status='RECEIVED'`, [challanId])).c)
    await q.run(`UPDATE job_work_challans SET status=?, close_reason=NULL, closed_at=NULL WHERE id=?`, [got > 0 ? 'PARTIAL' : 'OPEN', challanId])
    return lost.length
  })
}
/** Link / change / unlink (orderId null) the order a challan is for. Information only — it reserves no stock. */
export async function linkJobWorkOrder(challanId, orderId) {
  return tx(async (q) => {
    const c = await q.one('SELECT id, order_id FROM job_work_challans WHERE id=?', [challanId])
    if (!c) bad('Job work challan not found')
    if (orderId && Number(c.order_id) !== Number(orderId)) await requireLinkableOrder(q, orderId)
    await q.run('UPDATE job_work_challans SET order_id=? WHERE id=?', [orderId || null, challanId])
  })
}
/** Open orders that need job work (the choices for "Link to order"). */
export const listJobOrders = () =>
  all(`SELECT o.id, o.order_no, o.date, o.job_type, c.name AS customer_name, q.nick_name FROM orders o JOIN customers c ON c.id=o.customer_id JOIN qualities q ON q.id=o.quality_id
    WHERE o.job_work=1 AND o.status='OPEN' ORDER BY o.id DESC`)

// ---------------------------------------------------------------- withdrawals: finished goods "Others" + grey "Others" (R-WD)
export const WD_KIND_LABEL = { FG_OTHER: 'Finished goods', GREY_OTHER: 'Grey' }

async function saveWithdrawal(q, { kind, reason, date, notes, rows, fromStatus }) {
  const why = String(reason ?? '').trim()
  if (!why) bad('A reason is required')
  if (!date) bad('Date is required')
  if (!rows.length) bad('Select at least one taka')
  assertMove(fromStatus, 'WITHDRAWN')
  const ids = rows.map((t) => t.id)
  await requireTakas(q, ids, fromStatus, 'withdraw')
  const no = Number((await q.one('SELECT COALESCE(MAX(wd_no),0)+1 AS n FROM withdrawals')).n)
  const { lastId } = await q.run('INSERT INTO withdrawals (wd_no,kind,date,reason,notes,status,created_at) VALUES (?,?,?,?,?,?,?)', [no, kind, date, why, String(notes ?? '').trim() || null, 'ACTIVE', nowIso()])
  for (const part of chunks(rows, ROWS)) {
    await q.run(`INSERT INTO withdrawal_takas (withdrawal_id,taka_id,prev_status,meters) VALUES ${part.map(() => '(?,?,?,?)').join(',')}`, part.flatMap((t) => [lastId, t.id, fromStatus, t.m]))
  }
  await updateTakas(q, ids, `status='WITHDRAWN'`, [], fromStatus)
  await insertMoves(q, ids.map((taka_id) => ({ taka_id, from_status: fromStatus, to_status: 'WITHDRAWN', ref_type: 'WITHDRAWAL', ref_id: lastId, note: `WITHDRAWN (WD-${no}): ${why}` })))
  return lastId
}
/** Finished goods "Others": d: {reason, date, notes?, lines:[{quality_id, shade_id, takas?, meters?, kind?: 'plain' | 'jobworked'}]}. Returns the withdrawal id. */
export async function createFgWithdrawal({ reason, date, notes, lines }) {
  return tx(async (q) => {
    const picked = await pickFg(q, lines, { jobworkedAllowed: true })
    const rows = picked.flatMap((l) => l.picks.map((t) => ({ id: t.id, m: t.m })))
    return saveWithdrawal(q, { kind: 'FG_OTHER', reason, date, notes, rows, fromStatus: 'FOLDED' })
  })
}
/** Grey "Others": only grey at our place (GODOWN_GREY). d: {reason, date, notes?, taka_ids}. */
export async function createGreyWithdrawal({ reason, date, notes, taka_ids }) {
  if (!taka_ids?.length) bad('Select at least one taka')
  return tx(async (q) => {
    const ids = taka_ids.map(Number)
    const found = await requireTakas(q, ids, 'GODOWN_GREY', 'withdraw')
    return saveWithdrawal(q, { kind: 'GREY_OTHER', reason, date, notes, rows: found.map((t) => ({ id: t.id, m: Number(t.grey_meter) })), fromStatus: 'GODOWN_GREY' })
  })
}
/** Cancel a withdrawal: every taka goes back to the exact status it had; the withdrawal stays on record as Cancelled. */
export async function cancelWithdrawal(id) {
  return tx(async (q) => {
    const w = await q.one('SELECT * FROM withdrawals WHERE id=?', [id])
    if (!w) bad('Withdrawal not found')
    if (w.status !== 'ACTIVE') bad('This withdrawal is already cancelled')
    const rows = await q.all('SELECT taka_id, prev_status FROM withdrawal_takas WHERE withdrawal_id=?', [id])
    await requireTakas(q, rows.map((r) => Number(r.taka_id)), 'WITHDRAWN', 'cancel the withdrawal')
    const byPrev = new Map()
    for (const r of rows) { if (!byPrev.has(r.prev_status)) byPrev.set(r.prev_status, []); byPrev.get(r.prev_status).push(Number(r.taka_id)) }
    for (const [prev, ids] of byPrev) {
      assertMove('WITHDRAWN', prev)
      await updateTakas(q, ids, `status='${prev}'`, [], 'WITHDRAWN')
      await insertMoves(q, ids.map((taka_id) => ({ taka_id, from_status: 'WITHDRAWN', to_status: prev, ref_type: 'WITHDRAWAL', ref_id: id, note: `WITHDRAWAL WD-${w.wd_no} CANCELLED` })))
    }
    await q.run(`UPDATE withdrawals SET status='CANCELLED', cancelled_at=? WHERE id=?`, [nowIso(), id])
    return rows.length
  })
}
const WD_SQL = `SELECT w.*, (SELECT COUNT(*) FROM withdrawal_takas x WHERE x.withdrawal_id=w.id) AS takas,
  (SELECT ROUND(COALESCE(SUM(x.meters),0),2) FROM withdrawal_takas x WHERE x.withdrawal_id=w.id) AS meters,
  (SELECT GROUP_CONCAT(DISTINCT q.nick_name) FROM withdrawal_takas x JOIN takas t ON t.id=x.taka_id JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id WHERE x.withdrawal_id=w.id) AS qualities
  FROM withdrawals w`
/** filters: kind, status, from, to (dates). Newest first. */
export async function listWithdrawals(f = {}) {
  const where = [], args = []
  if (f.kind) { where.push('w.kind=?'); args.push(f.kind) }
  if (f.status) { where.push('w.status=?'); args.push(f.status) }
  if (f.from) { where.push('w.date>=?'); args.push(f.from) }
  if (f.to) { where.push('w.date<=?'); args.push(f.to) }
  const rows = await all(`${WD_SQL} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY w.date DESC, w.id DESC`, args)
  return rows.map((w) => ({ ...w, wd_label: `WD-${w.wd_no}`, takas: Number(w.takas), meters: r2(w.meters), kind_label: WD_KIND_LABEL[w.kind] || w.kind }))
}
export async function getWithdrawal(id) {
  const w = await one(`${WD_SQL} WHERE w.id=?`, [id])
  if (!w) return null
  const [takas, links] = await Promise.all([
    listTakas('WHERE t.id IN (SELECT taka_id FROM withdrawal_takas WHERE withdrawal_id=?)', [id]),
    all('SELECT taka_id, prev_status, meters FROM withdrawal_takas WHERE withdrawal_id=?', [id]),
  ])
  const by = new Map(links.map((l) => [Number(l.taka_id), l]))
  return { ...w, wd_label: `WD-${w.wd_no}`, takas_n: Number(w.takas), meters: r2(w.meters), kind_label: WD_KIND_LABEL[w.kind] || w.kind,
    takas: takas.map((t) => ({ ...t, prev_status: by.get(t.id)?.prev_status, wd_m: Number(by.get(t.id)?.meters ?? 0) })) }
}

// ---------------------------------------------------------------- grey direct sell (R-GS)
/** Grey at our place (GODOWN_GREY). filters: weaver_id, group_id, receipt_ids[], branch_id, quality_id. */
export function greyGodownTakas(f = {}) {
  const where = [`t.status='GODOWN_GREY'`], args = []
  if (f.weaver_id) { where.push('r.weaver_id=?'); args.push(f.weaver_id) }
  if (f.group_id) { where.push('g.id=?'); args.push(f.group_id) }
  if (f.receipt_ids?.length) { where.push(`t.receipt_id IN (${qs(f.receipt_ids)})`); args.push(...f.receipt_ids) }
  if (f.branch_id) { where.push('t.branch_id=?'); args.push(f.branch_id) }
  if (f.quality_id) { where.push('p.quality_id=?'); args.push(f.quality_id) }
  return listTakas(`WHERE ${where.join(' AND ')}`, args)
}
/**
 * Sell grey straight to a customer. d: {weaver_id, customer_id, taka_ids, date, rate?, notes?, receipt_ids?}.
 * The takas must be GODOWN_GREY of that one party (and of the chosen weaver challans when given). Returns the sale id.
 */
export async function createGreySale({ weaver_id, customer_id, taka_ids, date, rate, notes, receipt_ids }) {
  if (!weaver_id) bad('Choose the associated party whose grey is sold')
  if (!customer_id) bad('Choose the customer')
  if (!taka_ids?.length) bad('Select at least one taka')
  if (!date) bad('Date is required')
  const rt = rate === '' || rate == null ? null : Number(rate)
  if (rt != null && !(rt > 0)) bad('Rate must be greater than 0')
  return tx(async (q) => {
    if (!(await q.one('SELECT id FROM weavers WHERE id=?', [weaver_id]))) bad('Associated party not found')
    if (!(await q.one('SELECT id FROM customers WHERE id=?', [customer_id]))) bad('Customer not found')
    const ids = taka_ids.map(Number)
    await requireTakas(q, ids, 'GODOWN_GREY', 'sell')
    const info = []
    for (const part of chunks(ids, 400)) info.push(...(await q.all(`SELECT t.id, t.receipt_id, t.grey_meter, r.weaver_id FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id WHERE t.id IN (${qs(part)})`, part)))
    if (info.some((t) => Number(t.weaver_id) !== Number(weaver_id))) bad('Some takas belong to another associated party — a grey sale is for one associated party only')
    if (receipt_ids?.length) {
      const ok = new Set(receipt_ids.map(Number))
      if (info.some((t) => !ok.has(Number(t.receipt_id)))) bad('Some takas are not from the chosen weaver challans')
    }
    assertMove('GODOWN_GREY', 'GREY_SOLD')
    const no = Number((await q.one('SELECT COALESCE(MAX(gs_no),0)+1 AS n FROM grey_sales')).n)
    const { lastId } = await q.run('INSERT INTO grey_sales (gs_no,date,customer_id,weaver_id,rate,notes,created_at) VALUES (?,?,?,?,?,?,?)', [no, date, customer_id, weaver_id, rt, String(notes ?? '').trim() || null, nowIso()])
    for (const part of chunks(info, ROWS)) {
      await q.run(`INSERT INTO grey_sale_takas (sale_id,taka_id,meters) VALUES ${part.map(() => '(?,?,?)').join(',')}`, part.flatMap((t) => [lastId, t.id, Number(t.grey_meter)]))
    }
    await updateTakas(q, ids, `status='GREY_SOLD', grey_sale_id=?`, [lastId], 'GODOWN_GREY')
    await insertMoves(q, ids.map((taka_id) => ({ taka_id, from_status: 'GODOWN_GREY', to_status: 'GREY_SOLD', ref_type: 'GREY_SALE', ref_id: lastId, note: `GREY SOLD (GS-${no})` })))
    return lastId
  })
}
const GS_SQL = `SELECT gs.*, c.name AS customer_name, c.city AS customer_city, c.phone AS customer_phone, c.gstin AS customer_gstin, w.name AS weaver_name, g.name AS group_name,
  (SELECT COUNT(*) FROM grey_sale_takas x WHERE x.sale_id=gs.id) AS takas,
  (SELECT ROUND(COALESCE(SUM(x.meters),0),2) FROM grey_sale_takas x WHERE x.sale_id=gs.id) AS meters,
  (SELECT GROUP_CONCAT(DISTINCT q.nick_name) FROM grey_sale_takas x JOIN takas t ON t.id=x.taka_id JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id WHERE x.sale_id=gs.id) AS qualities
  FROM grey_sales gs JOIN customers c ON c.id=gs.customer_id JOIN weavers w ON w.id=gs.weaver_id JOIN weaver_groups g ON g.id=w.group_id`
const decorateGs = (s) => ({ ...s, gs_label: `GS-${s.gs_no}`, takas: Number(s.takas), meters: r2(s.meters), amount: s.rate != null ? r2(Number(s.rate) * Number(s.meters)) : null })
export async function listGreySales() { return (await all(`${GS_SQL} ORDER BY gs.date DESC, gs.id DESC`)).map(decorateGs) }
/** A grey sale with its takas, weaver challans and the timeline PO → challan received → sold. */
export async function getGreySale(id) {
  const s = await one(`${GS_SQL} WHERE gs.id=?`, [id])
  if (!s) return null
  const takas = await listTakas('WHERE t.grey_sale_id=?', [id])
  const challans = [], pos = []
  for (const t of takas) {
    if (!challans.some((c) => c.id === t.receipt_id)) challans.push({ id: t.receipt_id, challan_no: t.challan_no, date: t.receipt_date, branch_name: t.branch_name, quality: t.nick_name, po_no: t.po_no, takas: 0, m: 0 })
    const c = challans.find((x) => x.id === t.receipt_id); c.takas += 1; c.m = r2(c.m + Number(t.grey_meter))
    if (!pos.some((p) => p.po_id === t.po_id)) pos.push({ po_id: t.po_id, po_no: t.po_no })
  }
  const poRows = pos.length ? await all(`SELECT id, po_no, po_date FROM grey_pos WHERE id IN (${qs(pos)})`, pos.map((p) => p.po_id)) : []
  const dec = decorateGs(s)
  const timeline = [
    ...poRows.map((p) => ({ kind: 'po', title: `PO ${p.po_no}`, date: p.po_date, sub: 'Grey ordered' })),
    ...challans.map((c) => ({ kind: 'received', title: `Weaver challan ${c.challan_no}`, date: c.date, sub: `Received${c.branch_name ? ` at ${c.branch_name}` : ''} · ${c.takas} taka · ${c.m} m` })),
    { kind: 'sold', title: `Sold ${dec.gs_label}`, date: s.date, sub: `to ${s.customer_name}` },
  ]
  return { ...dec, takas, challans, timeline }
}

// ---------------------------------------------------------------- sell history (closed orders + grey sales)
/** filters: from, to (dates), customer_id, quality_id, type ('ORDER' | 'GREY'). Newest first, with totals (amount only where a rate is known). */
export async function sellHistory(f = {}) {
  const rows = []
  if (f.type !== 'GREY') {
    const where = [`o.status='DONE'`], args = []
    if (f.customer_id) { where.push('o.customer_id=?'); args.push(f.customer_id) }
    if (f.quality_id) { where.push('o.quality_id=?'); args.push(f.quality_id) }
    const orders = await all(`${OR_SQL} WHERE ${where.join(' AND ')}`, args)
    const sold = await all(`SELECT ref_id AS id, MAX(substr(at,1,10)) AS d FROM taka_moves WHERE ref_type='ORDER' GROUP BY ref_id`)
    const soldOn = new Map(sold.map((r) => [Number(r.id), r.d]))
    for (const o of orders) rows.push({ type: 'ORDER', id: o.id, no: o.order_no, date: soldOn.get(o.id) || o.date, customer_id: o.customer_id, customer_name: o.customer_name, qualities: o.nick_name, takas: Number(o.allocated), meters: r2(o.allocated_m), amount: o.rate != null ? r2(Number(o.allocated_m) * Number(o.rate)) : null, to: `/orders/${o.id}`, job_work: Number(o.job_work) === 1 ? o.job_type || 'Job work' : null })
  }
  if (f.type !== 'ORDER') {
    for (const s of await listGreySales()) {
      if (f.customer_id && Number(s.customer_id) !== Number(f.customer_id)) continue
      if (f.quality_id) {
        const has = await one(`SELECT 1 AS x FROM grey_sale_takas x JOIN takas t ON t.id=x.taka_id JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id WHERE x.sale_id=? AND p.quality_id=?`, [s.id, f.quality_id])
        if (!has) continue
      }
      rows.push({ type: 'GREY', id: s.id, no: s.gs_label, date: s.date, customer_id: s.customer_id, customer_name: s.customer_name, qualities: s.qualities, takas: s.takas, meters: s.meters, amount: s.amount, to: `/grey-sales/${s.id}` })
    }
  }
  const list = rows.filter((r) => (!f.from || (r.date || '') >= f.from) && (!f.to || (r.date || '') <= f.to)).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id)
  const known = list.filter((r) => r.amount != null)
  return {
    rows: list,
    totals: { entries: list.length, takas: list.reduce((s, r) => s + r.takas, 0), meters: r2(list.reduce((s, r) => s + r.meters, 0)), amount: known.length ? r2(known.reduce((s, r) => s + r.amount, 0)) : null },
  }
}

// ---------------------------------------------------------------- master detail screens (client changes 5)
// Every master entry opens a details screen: its own fields first, then what it is used in (POs, challans, orders, stock …).
const STOCK_SQL = `SELECT t.status, COUNT(*) AS c,
  ROUND(COALESCE(SUM(CASE WHEN t.status IN ('FOLDED','JOB_WORK','SOLD') THEN ${SELLABLE} WHEN t.status='FINISHED' THEN t.finished_meter ELSE t.grey_meter END),0),2) AS m
  FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN weavers w ON w.id=r.weaver_id
  LEFT JOIN program_lines pl ON pl.id=t.program_line_id LEFT JOIN programs pr ON pr.id=pl.program_id`
/** Takas matching `where` per inventory stage (same meters as the Inventory screen) + sold + everything received. */
async function stockSummary(where, args) {
  const rows = await all(`${STOCK_SQL} WHERE ${where} GROUP BY t.status`, args)
  const by = Object.fromEntries(rows.map((r) => [r.status, { takas: Number(r.c), m: r2(r.m) }]))
  const views = {}
  for (const [k, v] of Object.entries(INVENTORY_VIEWS)) {
    views[k] = v.statuses.reduce((a, st) => ({ takas: a.takas + (by[st]?.takas || 0), m: r2(a.m + (by[st]?.m || 0)) }), { takas: 0, m: 0 })
  }
  const total = { takas: rows.reduce((a, r) => a + Number(r.c), 0) }
  const inStock = Object.values(views).reduce((a, v) => ({ takas: a.takas + v.takas, m: r2(a.m + v.m) }), { takas: 0, m: 0 })
  return { views, inStock, sold: by.SOLD || { takas: 0, m: 0 }, greySold: by.GREY_SOLD || { takas: 0, m: 0 }, total }
}
const orderCounts = (orders) => {
  const pay = orders.reduce((a, o) => ({
    expected: a.expected + (o.payment.expected_amount || 0), dispatched: a.dispatched + (o.payment.dispatched_amount || 0),
    paid: a.paid + o.payment.paid, outstanding: a.outstanding + Math.max(0, o.payment.outstanding || 0), due: a.due + (o.payment.due ? 1 : 0),
  }), { expected: 0, dispatched: 0, paid: 0, outstanding: 0, due: 0 })
  return {
    total: orders.length, ongoing: orders.filter((o) => o.status !== 'DONE').length, completed: orders.filter((o) => o.status === 'DONE').length,
    dispatched_m: r2(orders.reduce((a, o) => a + Number(o.allocated_m || 0), 0)),
    payment: { expected: r2(pay.expected), dispatched: r2(pay.dispatched), paid: r2(pay.paid), outstanding: r2(pay.outstanding), due: pay.due, unrated: orders.filter((o) => o.payment.rate == null).length },
  }
}
const poCounts = (pos) => ({
  total: pos.length, open: pos.filter((x) => x.status === 'OPEN' || x.status === 'PARTIAL').length, done: pos.filter((x) => x.status === 'RECEIVED' || x.status === 'CLOSED').length,
  ordered_m: r2(pos.reduce((a, x) => a + Number(x.meters), 0)), received_m: r2(pos.reduce((a, x) => a + Number(x.received_m), 0)), pending_m: r2(pos.reduce((a, x) => a + x.pending_m, 0)),
})
const challanTotals = (rc) => ({ count: rc.length, takas: rc.reduce((a, r) => a + Number(r.taka_count), 0), m: r2(rc.reduce((a, r) => a + Number(r.total_m), 0)) })

export const MASTER_KINDS = ['weaver_groups', 'weavers', 'mills', 'customers', 'job_workers', 'qualities', 'branches', 'shades']

/** Everything the details screen of one master entry shows. kind: one of MASTER_KINDS. Returns null when the entry does not exist. */
export async function getMasterDetail(kind, id) {
  id = Number(id)
  if (kind === 'weaver_groups') {
    const g = await one('SELECT * FROM weaver_groups WHERE id=?', [id])
    if (!g) return null
    const [parties, pos, receipts, stock] = await Promise.all([
      all(`SELECT w.*, (SELECT COUNT(*) FROM grey_receipts r WHERE r.weaver_id=w.id) AS challans,
        (SELECT COUNT(*) FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id WHERE r.weaver_id=w.id) AS takas,
        (SELECT ROUND(COALESCE(SUM(t.grey_meter),0),2) FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id WHERE r.weaver_id=w.id) AS meters
        FROM weavers w WHERE w.group_id=? ORDER BY w.name`, [id]),
      all(`${PO_SQL} WHERE p.group_id=? ORDER BY p.id DESC`, [id]).then((r) => r.map(decoratePo)),
      listReceipts('WHERE w.group_id=?', [id]),
      stockSummary('w.group_id=?', [id]),
    ])
    return { kind, row: g, parties, pos, poCounts: poCounts(pos), receipts, challans: challanTotals(receipts), stock }
  }
  if (kind === 'weavers') {
    const w = await one('SELECT w.*, g.name AS group_name, g.city AS group_city FROM weavers w JOIN weaver_groups g ON g.id=w.group_id WHERE w.id=?', [id])
    if (!w) return null
    const [receipts, stock, sales] = await Promise.all([
      listReceipts('WHERE r.weaver_id=?', [id]), stockSummary('r.weaver_id=?', [id]),
      all(`${GS_SQL} WHERE gs.weaver_id=? ORDER BY gs.date DESC, gs.id DESC`, [id]).then((r) => r.map(decorateGs)),
    ])
    return { kind, row: w, receipts, challans: challanTotals(receipts), stock, greySales: sales }
  }
  if (kind === 'mills') {
    const m = await one('SELECT * FROM mills WHERE id=?', [id])
    if (!m) return null
    const [mains, olds, programs, atMill, direct] = await Promise.all([
      all(`${MAIN_SQL} WHERE mm.mill_id=? ORDER BY mm.id DESC`, [id]),
      all(`${DS_SQL} WHERE d.main_id IS NULL AND d.mill_id=? ORDER BY d.id DESC`, [id]),
      all(`${PG_SQL} WHERE pr.mill_id=? ORDER BY pr.id DESC`, [id]).then((r) => r.map((x) => ({ ...x, status: progStatus(x) }))),
      stockSummary('t.mill_id=?', [id]),
      one(`SELECT COUNT(*) AS c FROM grey_receipts WHERE destination='MILL' AND mill_id=?`, [id]),
    ])
    const finished = await one(`SELECT COUNT(*) AS c, ROUND(COALESCE(SUM(t.finished_meter),0),2) AS m FROM takas t JOIN program_lines pl ON pl.id=t.program_line_id JOIN programs pr ON pr.id=pl.program_id WHERE pr.mill_id=? AND t.finished_receipt_id IS NOT NULL`, [id])
    const challans = [...mains.map((x) => ({ ...x, kind: 'main', label: `Challan ${x.main_no}` })), ...olds.map((d) => ({ ...d, kind: 'old', label: `Old challan ${d.dispatch_no}`, status: 'OLD' }))]
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id)
    return {
      kind, row: m, challans, programs, stock: atMill, directChallans: Number(direct.c),
      programCounts: { total: programs.length, open: programs.filter((x) => x.status !== 'DONE').length, done: programs.filter((x) => x.status === 'DONE').length },
      finished: { takas: Number(finished.c), m: r2(finished.m) },
    }
  }
  if (kind === 'customers') {
    const c = await one('SELECT * FROM customers WHERE id=?', [id])
    if (!c) return null
    const [orders, sales] = await Promise.all([
      listOrders('WHERE o.customer_id=?', [id]),
      all(`${GS_SQL} WHERE gs.customer_id=? ORDER BY gs.date DESC, gs.id DESC`, [id]).then((r) => r.map(decorateGs)),
    ])
    return { kind, row: c, orders, orderCounts: orderCounts(orders), greySales: sales }
  }
  if (kind === 'job_workers') {
    const w = await one('SELECT * FROM job_workers WHERE id=?', [id])
    if (!w) return null
    const challans = await listJobWorks('WHERE c.job_worker_id=?', [id])
    const open = challans.filter((x) => x.status === 'OPEN' || x.status === 'PARTIAL')
    return {
      kind, row: w, challans,
      counts: { total: challans.length, open: open.length, done: challans.length - open.length, pending_takas: open.reduce((a, x) => a + Number(x.pending_takas), 0), pending_m: r2(open.reduce((a, x) => a + Number(x.pending_m), 0)) },
    }
  }
  if (kind === 'qualities') {
    const q = await one('SELECT * FROM qualities WHERE id=?', [id])
    if (!q) return null
    const [colours, orders, pos, programs, stock, dead, deadDays] = await Promise.all([
      listQualityColours(id), listOrders('WHERE o.quality_id=?', [id]),
      all(`${PO_SQL} WHERE p.quality_id=? ORDER BY p.id DESC`, [id]).then((r) => r.map(decoratePo)),
      all(`${PG_SQL} WHERE pr.quality_id=? OR EXISTS (SELECT 1 FROM program_lines x WHERE x.program_id=pr.id AND x.quality_id=?) ORDER BY pr.id DESC`, [id, id]).then((r) => r.map((x) => ({ ...x, status: progStatus(x) }))),
      stockSummary('p.quality_id=?', [id]),
      getDeadStockDays().then((d) => deadStock(d, { quality_id: id })), getDeadStockDays(),
    ])
    return {
      kind, row: q, colours, orders, orderCounts: orderCounts(orders), pos, poCounts: poCounts(pos), programs, stock,
      colourCounts: { total: colours.length, active: colours.filter((c) => c.active).length },
      dead: { days: deadDays, takas: dead.length, m: r2(dead.reduce((a, t) => a + Number(t.stock_m || 0), 0)) },
    }
  }
  if (kind === 'branches') {
    const b = await one('SELECT * FROM branches WHERE id=?', [id])
    if (!b) return null
    const [receipts, stock, byQuality] = await Promise.all([
      listReceipts('WHERE r.branch_id=?', [id]), stockSummary('t.branch_id=?', [id]),
      all(`SELECT p.quality_id, q.nick_name, COUNT(*) AS c, ROUND(COALESCE(SUM(t.grey_meter),0),2) AS m FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN qualities q ON q.id=p.quality_id
        WHERE t.status='GODOWN_GREY' AND t.branch_id=? GROUP BY p.quality_id, q.nick_name ORDER BY q.nick_name`, [id]),
    ])
    return { kind, row: b, receipts, challans: challanTotals(receipts), stock, godownByQuality: byQuality.map((r) => ({ quality_id: r.quality_id, nick_name: r.nick_name, takas: Number(r.c), m: r2(r.m) })) }
  }
  if (kind === 'shades') {
    const sh = await one('SELECT s.*, q.nick_name AS owner_quality FROM shades s LEFT JOIN qualities q ON q.id=s.quality_id WHERE s.id=?', [id])
    if (!sh) return null
    const [qualities, orderLines, programLines, stock] = await Promise.all([
      all(`SELECT q.id, q.nick_name, q.original_name, CASE WHEN COALESCE(qs.active,1)=1 THEN 1 ELSE 0 END AS active FROM quality_shades qs JOIN qualities q ON q.id=qs.quality_id WHERE qs.shade_id=? ORDER BY q.nick_name`, [id]),
      all(`SELECT o.id, o.order_no, o.date, o.status, c.name AS customer_name, q.nick_name, ol.taka_count, ol.meters FROM order_lines ol JOIN orders o ON o.id=ol.order_id JOIN customers c ON c.id=o.customer_id JOIN qualities q ON q.id=o.quality_id WHERE ol.shade_id=? ORDER BY o.id DESC`, [id]),
      one(`SELECT COUNT(DISTINCT pl.program_id) AS programs, COALESCE(SUM(pl.taka_count),0) AS takas FROM program_lines pl WHERE pl.shade_id=?`, [id]),
      stockSummary('pl.shade_id=?', [id]),
    ])
    return {
      kind, row: sh, qualities, orders: orderLines,
      orderCounts: { total: orderLines.length, ongoing: orderLines.filter((o) => o.status !== 'DONE').length, completed: orderLines.filter((o) => o.status === 'DONE').length },
      programs: { count: Number(programLines.programs), takas: Number(programLines.takas) }, stock,
    }
  }
  bad('Unknown master')
}

// ---------------------------------------------------------------- setup
/** Demo data is written ONLY into a completely empty local database (never a remote one unless explicitly allowed). */
let seeding
export function ensureSeed() {
  // memoised: React StrictMode mounts twice, and two concurrent seeds would insert the demo data twice
  return (seeding ||= seedIfEmpty())
}
async function seedIfEmpty() {
  // Never wipe data automatically: duplicate PO numbers / nicknames are only reported.
  try {
    const dup = await one(`SELECT (SELECT COUNT(*) FROM (SELECT po_no FROM grey_pos GROUP BY po_no HAVING COUNT(*) > 1)) AS po,
      (SELECT COUNT(*) FROM (SELECT nick_name FROM qualities GROUP BY nick_name HAVING COUNT(*) > 1)) AS q`)
    if (Number(dup?.po) > 0 || Number(dup?.q) > 0) console.warn(`Duplicate data found (${dup.po} PO numbers, ${dup.q} quality nicknames). Nothing was deleted — please review them.`)
  } catch (e) { console.warn('Duplicate check skipped:', e?.message) }
  if (mode !== 'local' && import.meta.env?.VITE_ALLOW_DEMO_SEED !== 'true') return
  for (const t of ['qualities', 'weaver_groups', 'mills', 'customers', 'locations', 'grey_pos', 'grey_receipts', 'takas', 'orders']) {
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
