export const fmtM = (v, d = 2) =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v))
    ? '—'
    : Number(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtInt = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'))
export const fmtMoney = (v) =>
  v == null ? '—' : '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
export const fmtPct = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v).toFixed(2)}%`)
export const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
export const qualityLabel = (q) => (q ? `${q.nick_name} (${q.original_name})` : '')
export const sum = (arr, f = (x) => x) => Math.round(arr.reduce((s, x) => s + Number(f(x) || 0), 0) * 100) / 100

/** Parse pasted meters: "96.5 102.58, 94.69\n103.5" → [96.5, 102.58, 94.69, 103.5] */
export function parseMeters(text) {
  return (text || '')
    .split(/[\s,;\t]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n) && n > 0)
}

/** Group array by key fn → [{key, items}] preserving first-seen order */
export function groupBy(arr, keyFn) {
  const map = new Map()
  for (const x of arr) {
    const k = keyFn(x)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(x)
  }
  return [...map.entries()].map(([key, items]) => ({ key, items }))
}

/** Whole days from date `d` (YYYY-MM-DD) to `now` (a Date, default today). */
export const daysBetween = (d, now = new Date()) => {
  const a = new Date(`${d}T00:00:00`), b = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((b - a) / 864e5)
}
/** "today", "yesterday", "12 days ago", "3 months ago", "2 years ago" — or "—" without a date. */
export function relativeDay(d, now = new Date()) {
  if (!d) return '—'
  const n = daysBetween(d, now)
  if (n <= 0) return n === 0 ? 'today' : `in ${-n} day${n === -1 ? '' : 's'}`
  if (n === 1) return 'yesterday'
  if (n < 30) return `${n} days ago`
  if (n < 365) { const m = Math.floor(n / 30); return `${m} month${m === 1 ? '' : 's'} ago` }
  const y = Math.floor(n / 365)
  return `${y} year${y === 1 ? '' : 's'} ago`
}
/** "Last program 12 days ago · Last order 3 days ago", or "Never used". */
export function lastUsedText(c, now = new Date()) {
  const parts = []
  if (c.last_program) parts.push(`Last program ${relativeDay(c.last_program, now)}`)
  if (c.last_order) parts.push(`Last order ${relativeDay(c.last_order, now)}`)
  return parts.length ? parts.join(' · ') : 'Never used'
}
