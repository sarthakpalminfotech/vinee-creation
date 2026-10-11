// End-to-end scenario (audit §4). Runs against a fresh in-memory DB. Usage: node tests/e2e.mjs
import { loadRepo } from './harness.mjs'

const { repo, close } = await loadRepo()
let pass = 0, fail = 0
const check = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`) }
const eq = (name, a, b) => check(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`)
const expectThrow = async (name, fn) => { try { await fn(); check(name, false, 'did not throw') } catch { check(name, true) } }
const r2 = (n) => Math.round(n * 100) / 100
const sum = (a) => r2(a.reduce((s, x) => s + x, 0))
const M = (t, o) => repo.saveMaster(t, o)

try {
  // 1. masters
  const grp = await M('weaver_groups', { name: 'Ganesh' })
  await M('weavers', { group_id: grp, name: 'Ganesh Textiles' })
  const fFab = await M('weavers', { group_id: grp, name: 'Ganesh Fabrics' })
  const fFas = await M('weavers', { group_id: grp, name: 'Ganesh Fashion' })
  const other = await M('weaver_groups', { name: 'Other Group' })
  const fOther = await M('weavers', { group_id: other, name: 'Other Firm' })
  const q = await M('qualities', { original_name: 'Nylon', nick_name: 'Gold Lava', taka_length: 100 })
  const m1 = await M('mills', { name: 'M1' })
  const rackA = await M('locations', { shop: 'Shop 6065', rack: 'Rack-A' })
  const rackB = await M('locations', { shop: 'Shop 6065', rack: 'Rack-B' })
  const chart = await M('shade_charts', { name: 'A' })
  const sh = {}
  for (const [n, hex] of [['36', '#7B1E3A'], ['37', '#2747B8'], ['38', '#138A8A'], ['39', '#1E9E5A']]) sh[n] = await M('shades', { chart_id: chart, number: n, name: n, hex })

  // 2. PO
  const po = await repo.createPO({ po_no: 'GT-118', po_date: '2026-01-01', group_id: grp, quality_id: q, meters: 50000, rate: 3.5, taka_length: 100 })
  let p = await repo.getPO(po)
  eq('PO opens as OPEN', p.status, 'OPEN')

  // 3. Receipt 1: 48 takas to godown from Ganesh Fabrics
  const meters1 = Array.from({ length: 48 }, (_, i) => 96 + (i % 9))
  meters1[0] = 94.69; meters1[1] = 102.58; meters1[2] = 103.5
  const r1 = await repo.createReceipt({ po_id: po, weaver_id: fFab, challan_no: 'GF-1', date: '2026-01-05', destination: 'GODOWN', takas: meters1.map((m, i) => ({ taka_no: i + 1, meter: m })) })
  const r1total = sum(meters1)
  p = await repo.getPO(po)
  eq('PO PARTIAL after receipt 1', p.status, 'PARTIAL')
  eq('PO received meters exact', p.received_m, r1total)
  const rc1 = await repo.getReceipt(r1)
  eq('receipt 1 total exact', rc1.total_m, r1total)
  eq('exact decimals kept (94.69)', rc1.takas[0].grey_meter, 94.69)
  await expectThrow('duplicate taka no in challan rejected', () => repo.createReceipt({ po_id: po, weaver_id: fFab, challan_no: 'GF-DUP', date: '2026-01-05', destination: 'GODOWN', takas: [{ taka_no: 1, meter: 99 }, { taka_no: 1, meter: 98 }] }))
  await expectThrow('party outside PO group rejected', () => repo.createReceipt({ po_id: po, weaver_id: fOther, challan_no: 'X-1', date: '2026-01-05', destination: 'GODOWN', takas: [{ taka_no: 1, meter: 99 }] }))
  await expectThrow('direct receipt without mill rejected', () => repo.createReceipt({ po_id: po, weaver_id: fFas, challan_no: 'X-2', date: '2026-01-05', destination: 'MILL', takas: [{ taka_no: 1, meter: 99 }] }))
  eq('failed receipts left no rows', (await repo.listReceipts()).length, 1)

  // 4. Receipt 2: 20 takas direct to M1 from Ganesh Fashion
  const meters2 = Array.from({ length: 20 }, (_, i) => 97 + (i % 6) + 0.25)
  const r2id = await repo.createReceipt({ po_id: po, weaver_id: fFas, challan_no: 'GFS-1', date: '2026-01-06', destination: 'MILL', mill_id: m1, takas: meters2.map((m, i) => ({ taka_no: 101 + i, meter: m })) })
  eq('godown has only receipt-1 takas', (await repo.listTakas("WHERE t.status='GODOWN_GREY'")).length, 48)
  const millNow = await repo.listTakas("WHERE t.status='MILL_GREY'")
  eq('grey at mill = 20 direct', millNow.length, 20)
  check('direct takas have no rack', millNow.every((t) => !t.location_id))

  // 5. Rack assignment (bulk)
  const ids1 = (await repo.listTakas('WHERE t.receipt_id=?', [r1])).map((t) => t.id)
  await repo.assignLocation(ids1.slice(0, 24), rackA)
  await repo.assignLocation(ids1.slice(24), rackB)
  eq('24 takas in Rack-A', (await repo.listTakas("WHERE t.status='GODOWN_GREY' AND t.location_id=?", [rackA])).length, 24)
  await expectThrow('cannot rack a taka that is at the mill', async () => repo.assignLocation([millNow[0].id], rackA))
  await repo.assignLocation([ids1[0]], rackB)
  await repo.assignLocation([ids1[0]], rackA) // move back
  if (repo.getTakaHistory) { const h = await repo.getTakaHistory(ids1[0]); check('location history kept (>=4 entries)', h.length >= 4, `got ${h.length}`) } else check('location history kept', false, 'no getTakaHistory')

  // 6. Send 36 of 48 to M1
  const send = ids1.slice(0, 36)
  const dc = await repo.createDispatch({ mill_id: m1, date: '2026-01-10', taka_ids: send })
  const d = await repo.getDispatch(dc)
  eq('challan has 36 takas', d.taka_count, 36)
  check('challan uses nickname', d.qualities === 'Gold Lava' && d.takas.every((t) => t.nick_name === 'Gold Lava'))
  eq('12 stay in godown', (await repo.listTakas("WHERE t.status='GODOWN_GREY'")).length, 12)
  eq('grey at mill = 56', (await repo.listTakas("WHERE t.status='MILL_GREY'")).length, 56)
  await expectThrow('double send rejected', () => repo.createDispatch({ mill_id: m1, date: '2026-01-11', taka_ids: [send[0]] }))
  await expectThrow('mixed send (one already sent) is atomic', () => repo.createDispatch({ mill_id: m1, date: '2026-01-11', taka_ids: [ids1[40], send[1]] }))
  eq('failed dispatch left 12 in godown', (await repo.listTakas("WHERE t.status='GODOWN_GREY'")).length, 12)
  if (repo.getPickList) {
    const pl = await repo.getPickList(dc)
    eq('pick list groups by rack', pl.map((g) => [g.label, g.takas.length]), [['Shop 6065 / Rack-A', 24], ['Shop 6065 / Rack-B', 12]])
  } else check('pick list grouped by rack', false, 'no getPickList')

  // 7. Program 48 takas: 24 x 37, 24 x 39
  const pg = await repo.createProgram({ mill_id: m1, quality_id: q, chart_id: chart, date: '2026-01-12', lines: [{ shade_id: sh['37'], taka_count: 24 }, { shade_id: sh['39'], taka_count: 24 }] })
  const prog = await repo.getProgram(pg)
  eq('program has 48 takas in dyeing', prog.takas.filter((t) => t.status === 'IN_DYEING').length, 48)
  eq('program lines 24/24', prog.lines.map((l) => [l.shade_no, l.allocated]), [['37', 24], ['39', 24]])
  await expectThrow('program beyond available grey rejected', () => repo.createProgram({ mill_id: m1, quality_id: q, chart_id: chart, date: '2026-01-12', lines: [{ shade_id: sh['38'], taka_count: 9 }] }))
  eq('8 grey left at mill', (await repo.listTakas("WHERE t.status='MILL_GREY'")).length, 8)

  // 8. Partial mill receipt: 30 takas
  const rows = prog.takas.slice(0, 30).map((t, i) => ({ id: t.id, mill_grey_meter: t.grey_meter, finished_meter: r2(t.grey_meter - 2 - (i % 3) * 0.5) }))
  await repo.createFinishedReceipt({ program_id: pg, challan_no: 'M1-77', date: '2026-01-20', rows })
  const prog2 = await repo.getProgram(pg)
  eq('30 finished, 18 pending', [prog2.received_takas, prog2.total_takas - prog2.received_takas], [30, 18])
  await expectThrow('cannot receive the same taka twice', () => repo.createFinishedReceipt({ program_id: pg, challan_no: 'M1-78', date: '2026-01-21', rows: [rows[0]] }))
  const t0 = prog2.takas.find((t) => t.id === rows[0].id)
  eq('finish loss per taka', t0.finishLoss, r2(t0.grey_meter - rows[0].finished_meter))
  check('pending per shade computed', prog2.lines.map((l) => l.taka_count - l.received).reduce((a, b) => a + b, 0) === 18)

  // 9. Folding with corrected meters
  const fold = rows.slice(0, 10).map((r, i) => ({ id: r.id, folded_meter: r2(r.finished_meter - (i % 2 ? 0.75 : 0.25)) }))
  await repo.foldTakas(fold, '2026-01-25')
  await expectThrow('cannot fold a taka that is not finished', () => repo.foldTakas([{ id: prog2.takas[40].id, folded_meter: 90 }], '2026-01-25'))
  const f0 = (await repo.listTakas('WHERE t.id=?', [fold[0].id]))[0]
  eq('folding loss', f0.foldLoss, r2(rows[0].finished_meter - fold[0].folded_meter))

  // 10. Reports
  eq('godown taka total loss = grey - folded', f0.totalLoss, r2(f0.grey_meter - fold[0].folded_meter))
  const directTaka = (await repo.listTakas('WHERE t.receipt_id=?', [r2id])).find((t) => t.status === 'IN_DYEING')
  check('direct taka has no weaver step', !!directTaka && directTaka.direct === true && directTaka.weaverLoss === null)
  await repo.createFinishedReceipt({ program_id: pg, challan_no: 'M1-79', date: '2026-01-22', rows: [{ id: directTaka.id, mill_grey_meter: directTaka.grey_meter, finished_meter: r2(directTaka.grey_meter - 3) }] })
  const dt = (await repo.listTakas('WHERE t.id=?', [directTaka.id]))[0]
  eq('direct taka total loss starts at mill grey', dt.totalLoss, 3)
  if (repo.shrinkageReport) {
    const rep = await repo.shrinkageReport()
    check('shrinkage report has taka rows', rep.rows.length === 31, `got ${rep.rows?.length}`)
    check('report groups exist', !!(rep.byPo && rep.byQuality && rep.byMill && rep.byProgram && rep.byParty))
  } else check('shrinkage report', false, 'no shrinkageReport')
  await repo.setPOClosed(po, true)
  p = await repo.getPO(po)
  eq('PO closed short status', p.status, 'CLOSED')
  eq('PO shortfall meters', p.shortfall, r2(50000 - p.received_m))
  check('PO shortfall % shown', p.shortfall_pct != null && Math.abs(p.shortfall_pct - p.shortfall / 500) < 0.01, `pct ${p.shortfall_pct}`)
  await expectThrow('closed PO refuses receipts', () => repo.createReceipt({ po_id: po, weaver_id: fFab, challan_no: 'LATE', date: '2026-02-01', destination: 'GODOWN', takas: [{ taka_no: 999, meter: 99 }] }))

  // 11. Inventory reconciles
  if (repo.inventoryCounts) {
    const inv = await repo.inventoryCounts()
    eq('inventory reconciles', inv.reconciled, true)
    eq('grey at our place', inv.views.godown.takas, 12)
    eq('in dyeing', inv.views.dyeing.takas, 48 - 31)
    eq('finished goods', inv.views.finished.takas, 31)
  } else check('inventory views', false, 'no inventoryCounts')
  eq('no taka lost', (await repo.listTakas()).length, 68)

  // extra rules: masters validation, PO status RECEIVED vs CLOSED, restrictions on delete
  await expectThrow('duplicate rack rejected', () => M('locations', { shop: 'shop 6065', rack: 'rack-a' }))
  await expectThrow('bad shade colour rejected', () => M('shades', { chart_id: chart, number: '40', name: 'x', hex: 'red' }))
  await expectThrow('duplicate shade number in chart rejected', () => M('shades', { chart_id: chart, number: '37', name: 'x', hex: '#000000' }))
  await expectThrow('master in use cannot be deleted', () => repo.removeMaster('mills', m1))
  const po2 = await repo.createPO({ po_no: 'FULL-1', po_date: '2026-02-01', group_id: grp, quality_id: q, meters: 200, rate: 3, taka_length: 100 })
  await expectThrow('duplicate PO number rejected', () => repo.createPO({ po_no: ' full-1 ', po_date: '2026-02-01', group_id: grp, quality_id: q, meters: 200, rate: 3 }))
  await repo.createReceipt({ po_id: po2, weaver_id: fFab, challan_no: 'F-1', date: '2026-02-02', destination: 'GODOWN', takas: [{ taka_no: 1, meter: 100.5 }, { taka_no: 2, meter: 99.5 }] })
  eq('fully received PO status', (await repo.getPO(po2)).status, 'RECEIVED')
  await expectThrow('more than 2 decimals rejected', () => repo.createReceipt({ po_id: po2, weaver_id: fFab, challan_no: 'F-2', date: '2026-02-02', destination: 'GODOWN', takas: [{ taka_no: 1, meter: 99.123 }] }))
  eq('inventory still reconciles', (await repo.inventoryCounts()).reconciled, true)

  // 12. availability for Gold Lava, shades 37 and 39
  if (repo.availabilityDetail) {
    const av = await repo.availabilityDetail(q, [sh['37'], sh['39']])
    check('availability has per-shade sections', av.shades.length === 2 && !!av.greyAtMill && !!av.greyAtPlace)
  } else check('availability detail', false, 'no availabilityDetail')
} catch (e) {
  fail++; console.log('FAIL  unexpected error:', e.stack || e)
}
console.log(`\n${pass} passed, ${fail} failed`)
await close()
process.exit(fail ? 1 : 0)
