// End-to-end scenario (audit §4 + client changes 1 + 2). Runs against a fresh throw-away DB.
//   npm test            → in-memory sql.js
//   npm run test:libsql → the Turso code path on a temporary local file: database
import { loadRepo } from './harness.mjs'

// harness.mjs already refuses anything but in-memory sql.js or a local file: database
const { repo, client, format, schema, driver, loadModule, close } = await loadRepo()
console.log(`driver: ${driver}`)
let pass = 0, fail = 0
const check = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`) }
const eq = (name, a, b) => check(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`)
const expectThrow = async (name, fn) => { try { await fn(); check(name, false, 'did not throw') } catch { check(name, true) } }
const r2 = (n) => Math.round(n * 100) / 100
const sum = (a) => r2(a.reduce((s, x) => s + x, 0))
const M = (t, o) => repo.saveMaster(t, o)
const cnt = async (sql) => Number((await client.all(sql))[0].c)
/** Statements the database received while `fn` ran. */
const counted = async (fn) => { const b = client.statementCount(); const out = await fn(); return { out, n: client.statementCount() - b } }

try {
  // 0. start-up: schema version stored (fast start-up on Turso)
  eq('schema_version stored', await repo.getSetting('schema_version'), String(schema.SCHEMA_VERSION))
  eq('hidden library chart exists', await cnt("SELECT COUNT(*) AS c FROM shade_charts WHERE name='__library__'"), 1)

  // 1. masters
  const grp = await M('weaver_groups', { name: 'Ganesh' })
  await M('weavers', { group_id: grp, name: 'Ganesh Textiles' })
  const fFab = await M('weavers', { group_id: grp, name: 'Ganesh Fabrics' })
  const fFas = await M('weavers', { group_id: grp, name: 'Ganesh Fashion' })
  const other = await M('weaver_groups', { name: 'Other Group' })
  const fOther = await M('weavers', { group_id: other, name: 'Other Firm' })
  const q = await M('qualities', { original_name: 'Nylon', nick_name: 'Gold Lava', taka_length: 100 })
  const m1 = await M('mills', { name: 'M1' })
  const br = await M('branches', { name: 'Surat Godown' })
  const br2 = await M('branches', { name: 'Bhiwandi Branch' })
  // colours: a common library; they belong to a quality once linked
  const sh = {}
  for (const [n, hex] of [['36', '#7B1E3A'], ['37', '#2747B8'], ['38', '#138A8A'], ['39', '#1E9E5A']]) sh[n] = await M('shades', { number: n, name: `Colour ${n}`, hex })
  const shImg = await M('shades', { number: 'Print-1', name: 'Only a photo', image_url: 'https://example.com/print1.jpg' })
  await expectThrow('bad shade colour rejected', () => M('shades', { number: '40', name: 'x', hex: 'red' }))
  await expectThrow('shade needs a colour or an image', () => M('shades', { number: '41', name: 'x' }))
  await expectThrow('shade name is required', () => M('shades', { name: 'x', hex: '#000000' }))
  await expectThrow('duplicate library shade name rejected (case-insensitive)', () => M('shades', { number: ' print-1 ', hex: '#000000' }))
  eq('colour library lists all 5', (await repo.listShades()).length, 5)
  eq('4 colours linked to the quality', await repo.addQualityColours(q, [sh['36'], sh['37'], sh['38'], sh['39']]), 4)
  eq('linking again adds nothing', await repo.addQualityColours(q, [sh['37']]), 0)

  // 2. PO
  const po = await repo.createPO({ po_no: 'GT-118', po_date: '2026-01-01', group_id: grp, quality_id: q, meters: 50000, rate: 3.5, taka_length: 100 })
  let p = await repo.getPO(po)
  eq('PO opens as OPEN', p.status, 'OPEN')

  // 3. Receipt 1: 48 takas to godown from Ganesh Fabrics
  const meters1 = Array.from({ length: 48 }, (_, i) => 96 + (i % 9))
  meters1[0] = 94.69; meters1[1] = 102.58; meters1[2] = 103.5
  const r1 = await repo.createReceipt({ po_id: po, weaver_id: fFab, challan_no: 'GF-1', date: '2026-01-05', destination: 'GODOWN', branch_id: br, takas: meters1.map((m, i) => ({ taka_no: i + 1, meter: m })) })
  const r1total = sum(meters1)
  p = await repo.getPO(po)
  eq('PO PARTIAL after receipt 1', p.status, 'PARTIAL')
  eq('PO received meters exact', p.received_m, r1total)
  const rc1 = await repo.getReceipt(r1)
  eq('receipt 1 total exact', rc1.total_m, r1total)
  eq('exact decimals kept (94.69)', rc1.takas[0].grey_meter, 94.69)
  await expectThrow('duplicate taka no in challan rejected', () => repo.createReceipt({ po_id: po, weaver_id: fFab, challan_no: 'GF-DUP', date: '2026-01-05', destination: 'GODOWN', branch_id: br, takas: [{ taka_no: 1, meter: 99 }, { taka_no: 1, meter: 98 }] }))
  await expectThrow('party outside PO group rejected', () => repo.createReceipt({ po_id: po, weaver_id: fOther, challan_no: 'X-1', date: '2026-01-05', destination: 'GODOWN', branch_id: br, takas: [{ taka_no: 1, meter: 99 }] }))
  await expectThrow('direct receipt without mill rejected', () => repo.createReceipt({ po_id: po, weaver_id: fFas, challan_no: 'X-2', date: '2026-01-05', destination: 'MILL', takas: [{ taka_no: 1, meter: 99 }] }))
  eq('failed receipts left no rows', (await repo.listReceipts()).length, 1)
  // two more grey challans for the godown (they travel to the mill together with GF-1)
  const r1b = await repo.createReceipt({ po_id: po, weaver_id: fFas, challan_no: 'GF-2', date: '2026-01-07', destination: 'GODOWN', branch_id: br, location_id: 999, takas: Array.from({ length: 12 }, (_, i) => ({ taka_no: 201 + i, meter: 98 + (i % 4) })) })
  const r1c = await repo.createReceipt({ po_id: po, weaver_id: fFab, challan_no: 'GF-3', date: '2026-01-07', destination: 'GODOWN', branch_id: br, takas: [{ taka_no: 301, meter: 99.5 }, { taka_no: 302, meter: 100.25 }, { taka_no: 303, meter: 97 }] })
  check('a rack is ignored: new takas have no location', (await repo.listTakas('WHERE t.receipt_id=?', [r1b])).every((t) => t.location_id == null))

  // 4. Receipt 2: 20 takas direct to M1 from Ganesh Fashion
  const meters2 = Array.from({ length: 20 }, (_, i) => 97 + (i % 6) + 0.25)
  const r2id = await repo.createReceipt({ po_id: po, weaver_id: fFas, challan_no: 'GFS-1', date: '2026-01-06', destination: 'MILL', mill_id: m1, takas: meters2.map((m, i) => ({ taka_no: 101 + i, meter: m })) })
  eq('godown has the takas of GF-1, GF-2, GF-3', (await repo.listTakas("WHERE t.status='GODOWN_GREY'")).length, 48 + 12 + 3)
  const millNow = await repo.listTakas("WHERE t.status='MILL_GREY'")
  eq('grey at mill = 20 direct', millNow.length, 20)
  check('direct takas have no rack', millNow.every((t) => !t.location_id))

  // 5. Mill challan: main + one sub-challan per weaver challan
  const ids1 = (await repo.listTakas('WHERE t.receipt_id=?', [r1])).map((t) => t.id)
  const idsB = (await repo.listTakas('WHERE t.receipt_id=?', [r1b])).map((t) => t.id)
  const idsC = (await repo.listTakas('WHERE t.receipt_id=?', [r1c])).map((t) => t.id)
  const rowsNow = async () => [await cnt('SELECT COUNT(*) AS c FROM mill_challan_mains'), await cnt('SELECT COUNT(*) AS c FROM mill_dispatches')]
  const before = await rowsNow()
  await expectThrow('no parts rejected', () => repo.createMillChallan({ mill_id: m1, date: '2026-01-10', parts: [] }))
  await expectThrow('part without takas rejected', () => repo.createMillChallan({ mill_id: m1, date: '2026-01-10', parts: [{ receipt_id: r1, taka_ids: [] }] }))
  await expectThrow('takas of another weaver challan are rejected', () => repo.createMillChallan({ mill_id: m1, date: '2026-01-10', parts: [{ receipt_id: r1, taka_ids: [ids1[0]] }, { receipt_id: r1b, taka_ids: [ids1[1]] }] }))
  await expectThrow('same weaver challan twice in one save rejected', () => repo.createMillChallan({ mill_id: m1, date: '2026-01-10', parts: [{ receipt_id: r1, taka_ids: [ids1[0]] }, { receipt_id: r1, taka_ids: [ids1[1]] }] }))
  await expectThrow('direct-to-mill challan cannot be sent', () => repo.createMillChallan({ mill_id: m1, date: '2026-01-10', parts: [{ receipt_id: r2id, taka_ids: [millNow[0].id] }] }))
  eq('failed mill challans left no rows', await rowsNow(), before)
  eq('nothing moved by the failed saves', (await repo.listTakas("WHERE t.status='GODOWN_GREY'")).length, 63)

  const mainId = await repo.createMillChallan({ mill_id: m1, date: '2026-01-10', notes: 'Urgent', parts: [{ receipt_id: r1, taka_ids: ids1.slice(0, 36) }, { receipt_id: r1b, taka_ids: idsB }] })
  let mc = await repo.getMillChallan(mainId)
  eq('main number starts at 1 and subs are 1A, 1B', [mc.main_no, mc.subs.map((s) => s.dispatch_no)], [1, ['1A', '1B']])
  eq('sub-challans carry weaver challan + counts', mc.subs.map((s) => [s.weaver_challan, s.taka_count]), [['GF-1', 36], ['GF-2', 12]])
  eq('main totals', [mc.sub_count, mc.taka_count, mc.status], [2, 48, 'OPEN'])
  check('challan uses nickname', mc.qualities === 'Gold Lava' && mc.subs.every((s) => s.takas.every((t) => t.nick_name === 'Gold Lava')))
  check('takas carry sub and main number', mc.subs[0].takas.every((t) => t.dispatch_no === '1A' && t.main_no === 1 && t.status === 'MILL_GREY' && !t.location_id))
  eq('GF-1 still has 12 in godown, GF-2 none', (await repo.listGodownChallans()).map((c) => [c.challan_no, c.godown_count]).sort(), [['GF-1', 12], ['GF-3', 3]])
  eq('picker can filter by quality', (await repo.listGodownChallans({ quality_id: q })).length, 2)
  eq('picker can filter by branch', (await repo.listGodownChallans({ branch_id: br2 })).length, 0)
  await expectThrow('double send rejected', () => repo.createMillChallan({ mill_id: m1, date: '2026-01-11', parts: [{ receipt_id: r1, taka_ids: [ids1[0]] }] }))
  await expectThrow('mixed send (one already sent) is atomic', () => repo.createMillChallan({ mill_id: m1, date: '2026-01-11', parts: [{ receipt_id: r1, taka_ids: [ids1[40], ids1[1]] }] }))
  eq('failed send left 12 + 3 in godown', (await repo.listTakas("WHERE t.status='GODOWN_GREY'")).length, 15)
  // add to the main: a new weaver challan gets 1C, the weaver challan of 1A extends 1A
  await repo.addToMillChallan(mainId, [{ receipt_id: r1c, taka_ids: idsC }, { receipt_id: r1, taka_ids: ids1.slice(36, 38) }])
  mc = await repo.getMillChallan(mainId)
  eq('addToMillChallan: 1C is new, 1A is extended', mc.subs.map((s) => [s.dispatch_no, s.taka_count]), [['1A', 38], ['1B', 12], ['1C', 3]])
  await repo.closeMillChallan(mainId)
  await expectThrow('a closed main refuses additions', () => repo.addToMillChallan(mainId, [{ receipt_id: r1, taka_ids: [ids1[38]] }]))
  await repo.reopenMillChallan(mainId)
  await repo.addToMillChallan(mainId, [{ receipt_id: r1, taka_ids: [ids1[38]] }])
  eq('reopen lets additions through (1A has 39)', (await repo.getMillChallan(mainId)).subs[0].taka_count, 39)
  await expectThrow('addToMillChallan with takas of another challan rejected', () => repo.addToMillChallan(mainId, [{ receipt_id: r1, taka_ids: [idsB[0]] }]))
  eq('9 of GF-1 stay in godown', (await repo.listTakas("WHERE t.status='GODOWN_GREY'")).length, 9)
  eq('grey at mill = 20 direct + 54 sent', (await repo.listTakas("WHERE t.status='MILL_GREY'")).length, 74)
  const mc2 = await repo.createMillChallan({ main_no: 100, mill_id: m1, date: '2026-01-11', parts: [{ receipt_id: r1, taka_ids: [ids1[39]] }] })
  eq('a free main number can be typed', (await repo.getMillChallan(mc2)).subs.map((s) => s.dispatch_no), ['100A'])
  await expectThrow('a used main number is refused', () => repo.createMillChallan({ main_no: 100, mill_id: m1, date: '2026-01-11', parts: [{ receipt_id: r1, taka_ids: [ids1[40]] }] }))
  const mc3 = await repo.createMillChallan({ mill_id: m1, date: '2026-01-11', parts: [{ receipt_id: r1, taka_ids: [ids1[40]] }] })
  eq('auto number continues after the highest (101)', (await repo.getMillChallan(mc3)).main_no, 101)
  const list = await repo.listMillChallans()
  eq('list shows one row per main with its subs', list.map((m) => [m.main_no, m.sub_count, m.taka_count]).sort((a, b) => a[0] - b[0]), [[1, 3, 54], [100, 1, 1], [101, 1, 1]])
  eq('7 of GF-1 stay in godown', (await repo.listTakas("WHERE t.status='GODOWN_GREY'")).length, 7)

  // 6. Colour rules for programs
  await repo.setQualityColourActive(q, sh['36'], false)
  await expectThrow('program with a colour that is not linked is rejected', () => repo.createProgram({ mill_id: m1, quality_id: q, date: '2026-01-12', lines: [{ shade_id: shImg, taka_count: 1 }] }))
  await expectThrow('program with an inactive colour is rejected', () => repo.createProgram({ mill_id: m1, quality_id: q, date: '2026-01-12', lines: [{ shade_id: sh['36'], taka_count: 1 }] }))
  await expectThrow('colour twice in a program rejected', () => repo.createProgram({ mill_id: m1, quality_id: q, date: '2026-01-12', lines: [{ shade_id: sh['37'], taka_count: 1 }, { shade_id: sh['37'], taka_count: 1 }] }))
  const pg = await repo.createProgram({ mill_id: m1, quality_id: q, date: '2026-01-12', lines: [{ shade_id: sh['37'], taka_count: 24 }, { shade_id: sh['39'], taka_count: 24 }] })
  const prog = await repo.getProgram(pg)
  eq('program has 48 takas in dyeing', prog.takas.filter((t) => t.status === 'IN_DYEING').length, 48)
  eq('program lines 24/24', prog.lines.map((l) => [l.shade_no, l.allocated]), [['37', 24], ['39', 24]])
  check('program has no chart name any more', prog.chart_name === undefined)
  await expectThrow('program beyond available grey rejected', () => repo.createProgram({ mill_id: m1, quality_id: q, date: '2026-01-12', lines: [{ shade_id: sh['38'], taka_count: 29 }] }))
  eq('28 grey left at mill', (await repo.listTakas("WHERE t.status='MILL_GREY'")).length, 28)

  // 7. Partial mill receipt: 30 takas — grey comes from the weaver challan
  const rows = prog.takas.slice(0, 30).map((t, i) => ({ id: t.id, finished_meter: r2(t.grey_meter - 2 - (i % 3) * 0.5) }))
  await expectThrow('a different mill grey meter is refused', () => repo.createFinishedReceipt({ program_id: pg, challan_no: 'M1-76', date: '2026-01-20', rows: [{ ...rows[0], mill_grey_meter: Number(prog.takas[0].grey_meter) + 1 }] }))
  await repo.createFinishedReceipt({ program_id: pg, challan_no: 'M1-77', date: '2026-01-20', rows })
  const prog2 = await repo.getProgram(pg)
  eq('30 finished, 18 pending', [prog2.received_takas, prog2.total_takas - prog2.received_takas], [30, 18])
  await expectThrow('cannot receive the same taka twice', () => repo.createFinishedReceipt({ program_id: pg, challan_no: 'M1-78', date: '2026-01-21', rows: [rows[0]] }))
  const t0 = prog2.takas.find((t) => t.id === rows[0].id)
  eq('mill shortage per taka = grey − finished', t0.millShortage, r2(t0.grey_meter - rows[0].finished_meter))
  eq('mill grey meter kept equal to the challan meter', t0.mill_grey_meter, t0.grey_meter)
  check('pending per shade computed', prog2.lines.map((l) => l.taka_count - l.received).reduce((a, b) => a + b, 0) === 18)

  // 8. Folding with corrected meters + damage
  const fold = rows.slice(0, 10).map((r, i) => ({ id: r.id, folded_meter: r2(r.finished_meter - (i % 2 ? 0.75 : 0.25)) }))
  await expectThrow('damaged meters above the folded meters rejected', () => repo.foldTakas([{ id: rows[20].id, folded_meter: 90, damage: { meters: 95 } }], '2026-01-25'))
  await expectThrow('damage needs meters', () => repo.foldTakas([{ id: rows[20].id, folded_meter: 90, damage: { meters: 0 } }], '2026-01-25'))
  eq('rejected damage folded nothing', [(await repo.listTakas("WHERE t.status='FOLDED'")).length, await cnt('SELECT COUNT(*) AS c FROM taka_damages')], [0, 0])
  fold[1].damage = { meters: 5.5, notes: 'torn near the selvedge', voice_local: true }
  fold[3].damage = { meters: 2 }
  const folded = await repo.foldTakas(fold, '2026-01-25')
  eq('fold returns the count and the damage ids', [folded.count, folded.damages.length], [10, 2])
  await expectThrow('cannot fold a taka that is not finished', () => repo.foldTakas([{ id: prog2.takas[40].id, folded_meter: 90 }], '2026-01-25'))
  const f0 = (await repo.listTakas('WHERE t.id=?', [fold[0].id]))[0]
  eq('folding shortage', f0.foldShortage, r2(rows[0].finished_meter - fold[0].folded_meter))
  const f1 = (await repo.listTakas('WHERE t.id=?', [fold[1].id]))[0]
  eq('damage saved with the folding', [f1.damage_m, f1.damage_notes, f1.damage_voice_local], [5.5, 'torn near the selvedge', 1])
  eq('sellable = folded − damaged', f1.sellable_m, r2(fold[1].folded_meter - 5.5))
  check('damage does not change the folding shortage', f1.foldShortage === r2(rows[1].finished_meter - fold[1].folded_meter))
  check('damage details know the origin', f1.challan_no === 'GF-1' && f1.dispatch_no === '1A' && f1.main_no === 1 && f1.program_no === prog.program_no && f1.finished_challan === 'M1-77' && !!f1.program_mill_name)
  eq('FOLDED history note mentions the damage', (await repo.getTakaHistory(fold[1].id)).pop().note, 'FOLDED (DAMAGED 5.5 m)')

  // 9. Shortage chain
  eq('godown taka total shortage = grey − folded', f0.totalShortage, r2(f0.grey_meter - fold[0].folded_meter))
  eq('percentages are against grey', f0.totalPct, r2(((f0.grey_meter - fold[0].folded_meter) / f0.grey_meter) * 100))
  const directTaka = (await repo.listTakas('WHERE t.receipt_id=?', [r2id])).find((t) => t.status === 'IN_DYEING')
  check('direct taka is flagged direct', !!directTaka && directTaka.direct === true)
  await repo.createFinishedReceipt({ program_id: pg, challan_no: 'M1-79', date: '2026-01-22', rows: [{ id: directTaka.id, finished_meter: r2(directTaka.grey_meter - 3) }] })
  const dt = (await repo.listTakas('WHERE t.id=?', [directTaka.id]))[0]
  eq('direct taka: same chain, total shortage = grey − finished', [dt.millShortage, dt.totalShortage, dt.foldShortage], [3, 3, null])
  const rep = await repo.shrinkageReport()
  eq('shrinkage report has taka rows', rep.rows.length, 31)
  check('report groups exist', !!(rep.byPo && rep.byQuality && rep.byMill && rep.byProgram && rep.byParty))
  const gq = rep.byQuality[0]
  check('no weaver / transit figures in report groups', !['weaverLoss', 'transitLoss', 'weaverShort', 'greyToMill', 'nominal', 'millGrey'].some((k) => k in gq) && !('weaverLoss' in rep.rows[0]))
  eq('quality group adds the per-taka shortages', [gq.millShortage, gq.totalShortage], [sum(rep.rows.map((t) => t.millShortage)), sum(rep.rows.map((t) => t.totalShortage))])
  eq('damage is reported separately', [gq.damage, gq.damagedTakas], [7.5, 2])
  eq('fold shortage only counts folded takas', gq.foldShortage, sum(rep.rows.filter((t) => t.folded_meter != null).map((t) => t.foldShortage)))
  await repo.setPOClosed(po, true)
  p = await repo.getPO(po)
  eq('PO closed short status', p.status, 'CLOSED')
  eq('PO shortfall meters', p.shortfall, r2(50000 - p.received_m))
  check('PO shortfall % shown', p.shortfall_pct != null && Math.abs(p.shortfall_pct - p.shortfall / 500) < 0.01, `pct ${p.shortfall_pct}`)
  await expectThrow('closed PO refuses receipts', () => repo.createReceipt({ po_id: po, weaver_id: fFab, challan_no: 'LATE', date: '2026-02-01', destination: 'GODOWN', branch_id: br, takas: [{ taka_no: 999, meter: 99 }] }))

  // 10. Inventory reconciles; sellable meters are used
  const inv = await repo.inventoryCounts()
  eq('inventory reconciles', inv.reconciled, true)
  eq('grey at our place', inv.views.godown.takas, 7)
  eq('in dyeing', inv.views.dyeing.takas, 48 - 31)
  eq('finished goods', inv.views.finished.takas, 31)
  const fin = await repo.inventoryList('finished', {})
  eq('finished-goods meters are sellable meters (folded − damaged)', inv.views.finished.m, sum(fin.map((t) => t.stock_m)))
  eq('a damaged taka stays one taka but counts fewer meters', fin.find((t) => t.id === fold[1].id).stock_m, r2(fold[1].folded_meter - 5.5))
  eq('Damaged filter', (await repo.inventoryList('finished', { damaged: true })).map((t) => t.damage_m).sort(), [2, 5.5])
  eq('no taka lost', (await repo.listTakas()).length, 83)

  // extra rules: masters validation, PO status RECEIVED vs CLOSED, restrictions on delete
  await expectThrow('master in use cannot be deleted', () => repo.removeMaster('mills', m1))
  await expectThrow('a library colour that a quality uses cannot be deleted', () => repo.removeMaster('shades', sh['37']))
  const po2 = await repo.createPO({ po_no: 'FULL-1', po_date: '2026-02-01', group_id: grp, quality_id: q, meters: 200, rate: 3, taka_length: 100 })
  await expectThrow('duplicate PO number rejected', () => repo.createPO({ po_no: ' full-1 ', po_date: '2026-02-01', group_id: grp, quality_id: q, meters: 200, rate: 3 }))
  await repo.createReceipt({ po_id: po2, weaver_id: fFab, challan_no: 'F-1', date: '2026-02-02', destination: 'GODOWN', branch_id: br, takas: [{ taka_no: 1, meter: 100.5 }, { taka_no: 2, meter: 99.5 }] })
  eq('fully received PO status', (await repo.getPO(po2)).status, 'RECEIVED')
  await expectThrow('more than 2 decimals rejected', () => repo.createReceipt({ po_id: po2, weaver_id: fFab, challan_no: 'F-2', date: '2026-02-02', destination: 'GODOWN', branch_id: br, takas: [{ taka_no: 1, meter: 99.123 }] }))
  eq('inventory still reconciles', (await repo.inventoryCounts()).reconciled, true)

  // 11. availability for Gold Lava, shades 37 and 39
  const av = await repo.availabilityDetail(q, [sh['37'], sh['39']])
  check('availability has per-shade sections', av.shades.length === 2 && !!av.greyAtMill && !!av.greyAtPlace)
  eq('grey at our place is grouped by branch only', [av.greyAtPlace.byLocation, av.greyAtPlace.byBranch.map((b) => b.label)], [undefined, ['Surat Godown']])
  eq('availability finished meters are sellable meters', av.shades.reduce((s, x) => s + x.finished.m, 0), sum(fin.map((t) => t.stock_m)))
  check('availability returns the colour', av.shades.find((s) => s.shade_id === sh['37']).hex === '#2747B8')
  // open POs block (client change 1): count + pending meters of Open / Partly received POs
  const qAv = await M('qualities', { original_name: 'Poly', nick_name: 'Avail Q', taka_length: 100 })
  await repo.createPO({ po_no: 'AV-OPEN', group_id: grp, quality_id: qAv, meters: 1000, rate: 3 })
  const avPart = await repo.createPO({ po_no: 'AV-PART', group_id: grp, quality_id: qAv, meters: 2000, rate: 3 })
  await repo.createReceipt({ po_id: avPart, weaver_id: fFab, challan_no: 'AV-1', date: '2026-02-05', destination: 'GODOWN', branch_id: br, takas: [{ taka_no: 1, meter: 300 }] })
  const avFull = await repo.createPO({ po_no: 'AV-FULL', group_id: grp, quality_id: qAv, meters: 100, rate: 3 })
  await repo.createReceipt({ po_id: avFull, weaver_id: fFab, challan_no: 'AV-2', date: '2026-02-05', destination: 'GODOWN', branch_id: br, takas: [{ taka_no: 1, meter: 100 }] })
  const avClosed = await repo.createPO({ po_no: 'AV-SHORT', group_id: grp, quality_id: qAv, meters: 500, rate: 3 })
  await repo.createReceipt({ po_id: avClosed, weaver_id: fFab, challan_no: 'AV-3', date: '2026-02-05', destination: 'GODOWN', branch_id: br, takas: [{ taka_no: 1, meter: 100 }] })
  await repo.setPOClosed(avClosed, true)
  eq('open POs: Open + Partly received only', (await repo.availabilityDetail(qAv, [])).openPos, { count: 2, pending_m: 2700 })
  eq('open POs of a quality without any', (await repo.availabilityDetail(await M('qualities', { original_name: 'x', nick_name: 'No PO', taka_length: 100 }), [])).openPos, { count: 0, pending_m: 0 })

  // 12. branches: grey is received at several branches
  await expectThrow('GODOWN receipt without a branch rejected', () => repo.createReceipt({ po_id: po2, weaver_id: fFab, challan_no: 'NB-1', date: '2026-02-03', destination: 'GODOWN', takas: [{ taka_no: 9, meter: 50 }] }))
  const rB2 = await repo.createReceipt({ po_id: po2, weaver_id: fFab, challan_no: 'B2-1', date: '2026-02-03', destination: 'GODOWN', branch_id: br2, takas: [{ taka_no: 1, meter: 80 }, { taka_no: 2, meter: 70.5 }] })
  const b2takas = await repo.listTakas('WHERE t.receipt_id=?', [rB2])
  check('takas carry their branch', b2takas.every((t) => t.branch_name === 'Bhiwandi Branch' && t.branch_id === br2))
  const gb = await repo.godownByBranch()
  eq('godown stock split by branch', gb.map((b) => [b.name, b.takas]).sort(), [['Bhiwandi Branch', 2], ['Surat Godown', 7 + 2 + 3]])
  eq('inventory filter by branch', (await repo.inventoryList('godown', { branch_id: br2 })).length, 2)

  // 13. colours belong to qualities
  const own = await repo.addOwnColour(q, { number: 'Own-Gold', name: 'Only for Gold Lava', hex: '#C9A227' })
  check('a private colour is not in the library', !(await repo.listShades()).some((s) => s.id === own))
  const qcols = await repo.listQualityColours(q)
  check('a private colour is in the quality list, marked private', qcols.find((c) => c.shade_id === own)?.private === true)
  eq('inactive colours sit at the end', qcols.map((c) => [c.number, c.active]).slice(-1), [['36', false]])
  eq('quality list carries the swatch', qcols.find((c) => c.number === '37').hex, '#2747B8')
  await expectThrow('private colour name must be unique within its quality', () => repo.addOwnColour(q, { number: 'own-gold', hex: '#000000' }))
  const qOther = await M('qualities', { original_name: 'Other', nick_name: 'Other Q', taka_length: 100 })
  check('another quality may use the same private name', !!(await repo.addOwnColour(qOther, { number: 'Own-Gold', hex: '#C9A227' })))
  await expectThrow('a private colour cannot be linked to another quality', () => repo.addQualityColours(qOther, [own]))
  await expectThrow('colour of another quality cannot be used in its program', () => repo.createProgram({ mill_id: m1, quality_id: qOther, date: '2026-01-12', lines: [{ shade_id: sh['37'], taka_count: 1 }] }))
  await expectThrow('a used colour cannot be removed from the quality', () => repo.removeQualityColour(q, sh['37']))
  await repo.removeQualityColour(q, own)
  check('an unused private colour can be removed (and goes away)', !(await repo.listQualityColours(q)).some((c) => c.shade_id === own) && (await cnt(`SELECT COUNT(*) AS c FROM shades WHERE id=${own}`)) === 0)
  await repo.setQualityColourActive(q, sh['37'], false)
  check('a used colour can be made inactive', (await repo.listQualityColours(q)).find((c) => c.number === '37').active === false)
  await repo.setQualityColourActive(q, sh['37'], true)
  await repo.setShadeActive(shImg, false)
  await expectThrow('an inactive library colour cannot be added to a quality', () => repo.addQualityColours(q, [shImg]))
  await repo.setShadeActive(shImg, true)
  eq('library shows used-by counts', (await repo.listShades()).find((s) => s.id === sh['37']).used_by, 1)

  // 14. order in meters (and takas) + edit; colours must be active for the quality
  const cust = await M('customers', { name: 'Radhe' })
  await expectThrow('order with an inactive colour is rejected', () => repo.createOrder({ order_no: 'SO-X1', customer_id: cust, quality_id: q, lines: [{ shade_id: sh['36'], taka_count: 1 }] }))
  await expectThrow('order with an unlinked colour is rejected', () => repo.createOrder({ order_no: 'SO-X2', customer_id: cust, quality_id: q, lines: [{ shade_id: shImg, taka_count: 1 }] }))
  const oid = await repo.createOrder({ order_no: 'SO-M1', customer_id: cust, quality_id: q, lines: [{ shade_id: sh['37'], meters: 250 }] })
  let ord = await repo.getOrder(oid)
  eq('order line stores meters, 0 takas, shade name', [ord.lines[0].meters, ord.lines[0].taka_count, ord.lines[0].shade_no], [250, 0, '37'])
  await expectThrow('order line needs takas or meters', () => repo.createOrder({ order_no: 'SO-M2', customer_id: cust, quality_id: q, lines: [{ shade_id: sh['37'] }] }))
  await repo.updateOrder(oid, { order_no: 'SO-M1', date: '2026-03-01', customer_id: cust, quality_id: q, notes: 'edited', lines: [{ shade_id: sh['37'], taka_count: 3, meters: 300 }] })
  ord = await repo.getOrder(oid)
  eq('order edited (notes, takas+meters)', [ord.notes, ord.lines[0].taka_count, ord.lines[0].meters], ['edited', 3, 300])
  const qc37 = (await repo.listQualityColours(q)).find((c) => c.number === '37')
  eq('last used: last program and last order dates', [qc37.last_program, qc37.last_order], ['2026-01-12', '2026-03-01'])
  eq('last used text', format.lastUsedText(qc37, new Date('2026-03-04T10:00:00')), 'Last program 1 month ago · Last order 3 days ago')
  eq('never used text', format.lastUsedText((await repo.listQualityColours(q)).find((c) => c.number === '38')), 'Never used')
  const nowD = new Date('2026-03-04T08:00:00')
  eq('relative days', [format.relativeDay('2026-03-04', nowD), format.relativeDay('2026-03-03', nowD), format.relativeDay('2026-02-20', nowD)], ['today', 'yesterday', '12 days ago'])

  // 15. GSTIN on mills and customers
  const gm = await M('mills', { name: 'GST Mill', gstin: ' 24aaacg1234f1z5 ' })
  const gc = await M('customers', { name: 'GST Customer', gstin: '27aabcb9988l1z9' })
  eq('GSTIN saved trimmed and upper-case', [(await repo.listMills()).find((m) => m.id === gm).gstin, (await repo.listCustomers()).find((c) => c.id === gc).gstin], ['24AAACG1234F1Z5', '27AABCB9988L1Z9'])
  const bm = await M('mills', { name: 'Bad GST Mill', gstin: 'abc123' })
  eq('an invalid GSTIN still saves (warning only)', (await repo.listMills()).find((m) => m.id === bm).gstin, 'ABC123')
  eq('GSTIN check helper', [repo.gstinLooksValid('24AAACG1234F1Z5'), repo.gstinLooksValid('abc'), repo.gstinLooksValid('  ')], [true, false, true])
  eq('GSTIN is optional', (await repo.listMills()).find((m) => m.name === 'M1').gstin, null)
  await M('mills', { id: gm, name: 'GST Mill', gstin: '' })
  eq('GSTIN can be cleared', (await repo.listMills()).find((m) => m.id === gm).gstin, null)

  // 16. edit PO and challan
  await repo.updatePO(po2, { po_no: 'FULL-1', po_date: '2026-02-01', group_id: grp, quality_id: q, meters: 400, rate: 3.25, taka_length: 100, notes: 'revised' })
  eq('PO edited', [(await repo.getPO(po2)).meters, (await repo.getPO(po2)).rate, (await repo.getPO(po2)).notes], [400, 3.25, 'revised'])
  await expectThrow('PO number must stay unique on edit', () => repo.updatePO(po2, { po_no: 'GT-118', group_id: grp, quality_id: q, meters: 400, rate: 3 }))
  await expectThrow('PO group locked once received', () => repo.updatePO(po2, { po_no: 'FULL-1', group_id: other, quality_id: q, meters: 400, rate: 3 }))
  await repo.updateReceipt(rB2, { challan_no: 'B2-1X', date: '2026-02-04', weaver_id: fFab, notes: 'n', takas: [{ id: b2takas[0].id, taka_no: 1, meter: 81.25 }, { taka_no: 3, meter: 60 }] })
  const rb2 = await repo.getReceipt(rB2)
  eq('challan edited: header + takas', [rb2.challan_no, rb2.takas.map((t) => [t.taka_no, t.grey_meter])], ['B2-1X', [['1', 81.25], ['3', 60]]])
  await repo.updateReceipt(rB2, { challan_no: 'B2-1X', date: '2026-02-04', weaver_id: fFab, branch_id: br, takas: rb2.takas.map((t) => ({ id: t.id, taka_no: t.taka_no, meter: t.grey_meter })) })
  eq('challan moved to another branch', (await repo.getReceipt(rB2)).takas.every((t) => t.branch_id === br && !t.location_id), true)
  const r1full = await repo.getReceipt(r1)
  await expectThrow('takas of a challan already sent to a mill are locked', () => repo.updateReceipt(r1, { challan_no: 'GF-1', date: '2026-01-05', weaver_id: fFab, takas: r1full.takas.map((t) => ({ id: t.id, taka_no: t.taka_no, meter: 1 })) }))
  await repo.updateReceipt(r1, { challan_no: 'GF-1', date: '2026-01-05', weaver_id: fFab, notes: 'header only' })
  eq('header of a processed challan can still change', (await repo.getReceipt(r1)).notes, 'header only')
  eq('inventory reconciles after edits', (await repo.inventoryCounts()).reconciled, true)

  // 17. dead stock: finished goods untouched for N days (N is a user setting)
  eq('default dead-stock days', await repo.getDeadStockDays(), 30)
  await expectThrow('dead-stock days must be a whole number >= 1', () => repo.setDeadStockDays(0))
  eq('dead-stock days saved', await repo.setDeadStockDays(45), 45)
  eq('dead-stock days read back', await repo.getDeadStockDays(), 45)
  const finishedNow = await repo.inventoryList('finished', {})
  check('there is finished stock to test with', finishedNow.length > 0)
  eq('nothing is dead today', (await repo.deadStock(45)).length, 0)
  eq('everything finished is dead after 46 days', (await repo.deadStock(45, {}, Date.now() + 46 * 864e5)).length, finishedNow.length)
  eq('boundary: 44 days idle is not dead for a 45-day rule', (await repo.deadStock(45, {}, Date.now() + 44 * 864e5)).length, 0)

  // 18. order allocation uses sellable meters (folded − damaged)
  const fifo = await repo.listTakas(`WHERE t.status='FOLDED' AND pl.shade_id=?`, [sh['37']])
  check('there are folded takas of colour 37, the 2nd one damaged', fifo.length >= 2 && fifo[0].damage_m == null && fifo[1].damage_m != null)
  const oa = await repo.createOrder({ order_no: 'SO-ALLOC', customer_id: cust, quality_id: q, lines: [{ shade_id: sh['37'], meters: r2(fifo[0].sellable_m + 0.01) }] })
  await repo.allocateOrder(oa)
  const done = await repo.getOrder(oa)
  eq('meters order allocates against sellable meters (needs a 2nd taka)', [done.takas.length, done.lines[0].allocated_m], [2, r2(fifo[0].sellable_m + fifo[1].sellable_m)])
  eq('allocated meters on the order are sellable meters', done.allocated_m, r2(fifo[0].sellable_m + fifo[1].sellable_m))
  eq('inventory reconciles after allocation', (await repo.inventoryCounts()).reconciled, true)

  // 19. legacy createDispatch still works (creates a main + one sub per weaver challan)
  const left = (await repo.listTakas("WHERE t.status='GODOWN_GREY' AND t.receipt_id=?", [r1])).slice(0, 2).map((t) => t.id)
  const legacy = await repo.createDispatch({ mill_id: m1, date: '2026-04-01', taka_ids: left })
  const lm = await repo.getMillChallan(legacy)
  eq('createDispatch makes a main with a sub', [lm.sub_count, lm.subs[0].dispatch_no.endsWith('A'), lm.taka_count], [1, true, 2])

  // 20. old challans (no main) stay readable
  const oldId = (await client.run("INSERT INTO mill_dispatches (dispatch_no,date,mill_id) VALUES ('DC-0001','2025-12-01',?)", [m1])).lastId
  const oldRow = (await repo.listMillChallans()).find((d) => d.kind === 'old')
  eq('old challans appear as single "Old challan" rows', [oldRow.label, oldRow.sub_count, oldRow.id], ['Old challan DC-0001', 0, oldId])
  eq('old challan detail still opens', (await repo.getDispatch(oldId)).dispatch_no, 'DC-0001')

  // 21. batching: 500 takas per save stay within the statement budget (Turso round trips)
  const qBig = await M('qualities', { original_name: 'Big', nick_name: 'Big Q', taka_length: 100 })
  const bigA = await M('shades', { number: 'Big-A', hex: '#111111' }), bigB = await M('shades', { number: 'Big-B', hex: '#222222' })
  await repo.addQualityColours(qBig, [bigA, bigB])
  const poBig = await repo.createPO({ po_no: 'BIG-1', group_id: grp, quality_id: qBig, meters: 200000, rate: 3 })
  const N = 500, LIMIT = 20
  const bigTakas = Array.from({ length: N }, (_, i) => ({ taka_no: i + 1, meter: 95 + (i % 10) + 0.5 }))
  let step = await counted(() => repo.createReceipt({ po_id: poBig, weaver_id: fFab, challan_no: 'BIG-R', date: '2026-05-01', destination: 'GODOWN', branch_id: br, takas: bigTakas }))
  const rBig = step.out
  check(`receipt of ${N} takas: ${step.n} statements`, step.n <= LIMIT, `got ${step.n}`)
  const bigIds = (await repo.listTakas('WHERE t.receipt_id=?', [rBig])).map((t) => t.id)
  eq('all 500 takas saved', bigIds.length, N)
  step = await counted(() => repo.createMillChallan({ mill_id: m1, date: '2026-05-02', parts: [{ receipt_id: rBig, taka_ids: bigIds }] }))
  check(`send of ${N} takas: ${step.n} statements`, step.n <= LIMIT, `got ${step.n}`)
  step = await counted(() => repo.createProgram({ mill_id: m1, quality_id: qBig, date: '2026-05-03', lines: [{ shade_id: bigA, taka_count: 250 }, { shade_id: bigB, taka_count: 250 }] }))
  check(`program of ${N} takas: ${step.n} statements`, step.n <= LIMIT, `got ${step.n}`)
  const pgBig = step.out
  step = await counted(() => repo.createFinishedReceipt({ program_id: pgBig, challan_no: 'BIG-M', date: '2026-05-10', rows: bigIds.map((id, i) => ({ id, finished_meter: 90 + (i % 7) + 0.25 })) }))
  check(`mill receipt of ${N} takas: ${step.n} statements`, step.n <= LIMIT, `got ${step.n}`)
  step = await counted(() => repo.foldTakas(bigIds.map((id, i) => ({ id, folded_meter: 89 + (i % 5) + 0.25, damage: i % 50 === 0 ? { meters: 1.5 } : undefined })), '2026-05-12'))
  check(`folding of ${N} takas (10 damaged): ${step.n} statements`, step.n <= LIMIT, `got ${step.n}`)
  eq('every big taka folded, 10 damaged', [(await repo.listTakas("WHERE t.status='FOLDED' AND p.quality_id=?", [qBig])).length, step.out.damages.length], [N, 10])
  step = await counted(() => repo.updateReceipt(rBig, { challan_no: 'BIG-R', date: '2026-05-01', weaver_id: fFab, notes: 'x' }))
  check('header-only edit is a handful of statements', step.n <= 10, `got ${step.n}`)
  const bigDirect = await repo.createReceipt({ po_id: poBig, weaver_id: fFab, challan_no: 'BIG-E', date: '2026-05-01', destination: 'MILL', mill_id: m1, takas: bigTakas.slice(0, 400) })
  const bigEdit = await repo.getReceipt(bigDirect)
  step = await counted(() => repo.updateReceipt(bigDirect, { challan_no: 'BIG-E', date: '2026-05-01', weaver_id: fFab, takas: bigEdit.takas.map((t, i) => ({ id: t.id, taka_no: t.taka_no, meter: i % 2 ? t.grey_meter : t.grey_meter + 1 })) }))
  check(`edit of ${bigEdit.takas.length} takas: ${step.n} statements`, step.n <= LIMIT, `got ${step.n}`)
  eq('big edit applied', (await repo.getReceipt(bigDirect)).takas.slice(0, 2).map((t) => t.grey_meter), [r2(bigEdit.takas[0].grey_meter + 1), bigEdit.takas[1].grey_meter])

  // 22. reconciliation at the end
  eq('inventory reconciles at the end', (await repo.inventoryCounts()).reconciled, true)
  eq('no taka lost at the end', (await repo.listTakas()).length, 83 + 2 + 3 + 2 + 500 + 400)

  // ======================================================================= client changes 2: job work, withdrawals, grey sell, sell history
  const BASE_TAKAS = await cnt('SELECT COUNT(*) AS c FROM takas')
  const moves = (id) => client.all('SELECT * FROM taka_moves WHERE taka_id=? ORDER BY id', [id])
  const statusOf = async (id) => (await client.all('SELECT status FROM takas WHERE id=?', [id]))[0].status
  const reconciled = async (label) => { const c = await repo.inventoryCounts(); check(`reconciled: ${label}`, c.reconciled, JSON.stringify(c.views)); return c }

  // --- helper: make folded stock for a quality ({shadeId: count}); the first half folds on an earlier date than the rest
  let poSeq = 0
  const makeFolded = async (qid, split, { damageEvery = 0 } = {}) => {
    const total = Object.values(split).reduce((s, n) => s + n, 0)
    const tag = `CC2-${++poSeq}`
    const poId = await repo.createPO({ po_no: tag, group_id: grp, quality_id: qid, meters: 1e6, rate: 3 })
    const rid = await repo.createReceipt({ po_id: poId, weaver_id: fFab, challan_no: `${tag}-R`, date: '2026-06-01', destination: 'GODOWN', branch_id: br, takas: Array.from({ length: total }, (_, i) => ({ taka_no: i + 1, meter: 100 + (i % 5) })) })
    const ids = (await repo.listTakas('WHERE t.receipt_id=?', [rid])).map((t) => t.id)
    await repo.createMillChallan({ mill_id: m1, date: '2026-06-02', parts: [{ receipt_id: rid, taka_ids: ids }] })
    const pg = await repo.createProgram({ mill_id: m1, quality_id: qid, date: '2026-06-03', lines: Object.entries(split).map(([s, c]) => ({ shade_id: Number(s), taka_count: c })) })
    const inDye = await repo.listTakas("WHERE t.status='IN_DYEING' AND pl.program_id=?", [pg])
    await repo.createFinishedReceipt({ program_id: pg, challan_no: `${tag}-M`, date: '2026-06-10', rows: inDye.map((t) => ({ id: t.id, finished_meter: Number(t.grey_meter) - 2 })) })
    const rows = inDye.map((t, i) => ({ id: t.id, folded_meter: 90 + (Number(t.taka_no) % 3), damage: damageEvery && i % damageEvery === 0 ? { meters: 1.5 } : undefined }))
    const half = Math.ceil(rows.length / 2)
    await repo.foldTakas(rows.slice(0, half), '2026-06-11')
    await repo.foldTakas(rows.slice(half), '2026-06-12')
    return { poId, rid, ids, pg }
  }

  // two qualities x two colours + a job worker
  const qA = await M('qualities', { original_name: 'Alpha raw', nick_name: 'Alpha', taka_length: 100 })
  const qB = await M('qualities', { original_name: 'Beta raw', nick_name: 'Beta', taka_length: 100 })
  const cs = {}
  for (const [k, hex] of [['A1', '#AA0000'], ['A2', '#00AA00'], ['B1', '#0000AA'], ['B2', '#AAAA00']]) cs[k] = await M('shades', { number: `CC2-${k}`, hex })
  await repo.addQualityColours(qA, [cs.A1, cs.A2]); await repo.addQualityColours(qB, [cs.B1, cs.B2])
  await makeFolded(qA, { [cs.A1]: 8, [cs.A2]: 6 }, { damageEvery: 4 })
  await makeFolded(qB, { [cs.B1]: 8, [cs.B2]: 4 })
  await reconciled('after building the job work stock')

  // --- job workers master
  const jwk = await M('job_workers', { name: 'Shree Embroidery', phone: '99', city: 'Surat', gstin: ' 24aaacg1234f1z5 ' })
  const jwk2 = await M('job_workers', { name: 'Print House' })
  eq('job worker gstin trimmed + upper-case', (await repo.listJobWorkers()).find((w) => w.id === jwk).gstin, '24AAACG1234F1Z5')
  await expectThrow('job worker name must be unique', () => M('job_workers', { name: 'shree embroidery' }))
  await expectThrow('job worker name is required', () => M('job_workers', { phone: '1' }))
  const jwTmp = await M('job_workers', { name: 'Temp JW' })
  await repo.removeMaster('job_workers', jwTmp)
  eq('an unused job worker can be deleted', (await repo.listJobWorkers()).length, 2)

  // --- statuses + state machine
  check('JOB_WORK / NOT_RETURNED / WITHDRAWN / GREY_SOLD have labels', ['JOB_WORK', 'NOT_RETURNED', 'WITHDRAWN', 'GREY_SOLD'].every((s) => repo.STATUS_META[s]))
  eq('INACTIVE_STATUSES', [...repo.INACTIVE_STATUSES].sort(), ['GREY_SOLD', 'NOT_RETURNED', 'SOLD', 'WITHDRAWN'])
  check('allowed transitions', [['FOLDED', 'JOB_WORK'], ['JOB_WORK', 'FOLDED'], ['JOB_WORK', 'NOT_RETURNED'], ['NOT_RETURNED', 'JOB_WORK'], ['FOLDED', 'WITHDRAWN'], ['GODOWN_GREY', 'WITHDRAWN'], ['WITHDRAWN', 'FOLDED'], ['WITHDRAWN', 'GODOWN_GREY'], ['GODOWN_GREY', 'GREY_SOLD']].every(([a, b]) => repo.canMove(a, b)))
  check('forbidden transitions', [['FINISHED', 'JOB_WORK'], ['MILL_GREY', 'GREY_SOLD'], ['FOLDED', 'GREY_SOLD'], ['GODOWN_GREY', 'JOB_WORK'], ['SOLD', 'FOLDED'], ['MILL_GREY', 'WITHDRAWN']].every(([a, b]) => !repo.canMove(a, b)))

  // --- FG stock figures + preview
  const stockA1 = (await repo.listFgStock()).find((r) => r.shade_id === cs.A1)
  eq('FG stock of Alpha / A1 (plain)', [stockA1.plain_takas, stockA1.jw_takas], [8, 0])
  const prev = await repo.previewFgPick([{ quality_id: qA, shade_id: cs.A1, takas: 3 }])
  eq('preview picks 3 takas without changing anything', [prev[0].takas, await cnt("SELECT COUNT(*) AS c FROM takas WHERE status='JOB_WORK'")], [3, 0])

  // --- JW-1: two qualities x two colours, entered by takas and by meters
  const fifoOf = async (qid, shade) => (await client.all(`SELECT t.id, ROUND(COALESCE(t.jw_return_meter, t.folded_meter - COALESCE(dm.meters,0)),2) AS m FROM takas t JOIN grey_receipts r ON r.id=t.receipt_id JOIN grey_pos p ON p.id=r.po_id JOIN program_lines pl ON pl.id=t.program_line_id LEFT JOIN taka_damages dm ON dm.taka_id=t.id WHERE t.status='FOLDED' AND t.jw_type IS NULL AND p.quality_id=? AND pl.shade_id=? ORDER BY t.folded_on, t.id`, [qid, shade])).map((r) => ({ id: Number(r.id), m: Number(r.m) }))
  const fifoA1 = await fifoOf(qA, cs.A1), fifoA2 = await fifoOf(qA, cs.A2), fifoB1 = await fifoOf(qB, cs.B1)
  const wantA2m = 200
  await expectThrow('a line needs takas or meters', () => repo.createJobWork({ job_worker_id: jwk, date: '2026-07-01', lines: [{ quality_id: qA, shade_id: cs.A1 }] }))
  await expectThrow('a job worker is required', () => repo.createJobWork({ date: '2026-07-01', lines: [{ quality_id: qA, shade_id: cs.A1, takas: 1 }] }))
  await expectThrow('not enough stock is rejected', () => repo.createJobWork({ job_worker_id: jwk, date: '2026-07-01', lines: [{ quality_id: qA, shade_id: cs.A1, takas: 99 }] }))
  await expectThrow('not enough meters is rejected', () => repo.createJobWork({ job_worker_id: jwk, date: '2026-07-01', lines: [{ quality_id: qA, shade_id: cs.A1, meters: 99999 }] }))
  await expectThrow('a bad line rolls the whole save back', () => repo.createJobWork({ job_worker_id: jwk, date: '2026-07-01', lines: [{ quality_id: qA, shade_id: cs.A1, takas: 1 }, { quality_id: qB, shade_id: cs.B2, takas: 50 }] }))
  eq('failed saves left no challan and no JOB_WORK takas', [await cnt('SELECT COUNT(*) AS c FROM job_work_challans'), await cnt("SELECT COUNT(*) AS c FROM takas WHERE status='JOB_WORK'")], [0, 0])
  const jw1 = await repo.createJobWork({
    job_worker_id: jwk, job_type: 'Embroidery', date: '2026-07-01', notes: 'rush',
    lines: [
      { quality_id: qA, shade_id: cs.A1, takas: 3 },
      { quality_id: qA, shade_id: cs.A2, meters: wantA2m },
      { quality_id: qB, shade_id: cs.B1, takas: 2, meters: 300 },
      { quality_id: qB, shade_id: cs.B2, takas: 1 },
    ],
  })
  let j1 = await repo.getJobWork(jw1)
  eq('first challan is JW-1', [j1.jw_no, j1.jw_label, j1.status], [1, 'JW-1', 'OPEN'])
  const pickedA1 = j1.takas.filter((t) => t.shade_id === cs.A1).map((t) => t.taka_id)
  eq('line A1 took the 3 oldest plain takas', pickedA1, fifoA1.slice(0, 3).map((t) => t.id))
  const pickedA2 = j1.takas.filter((t) => t.shade_id === cs.A2)
  const a2m = pickedA2.map((t) => t.sent_m)
  check('meters line: whole takas, only the last overshoots', sum(a2m) >= wantA2m && sum(a2m.slice(0, -1)) < wantA2m, JSON.stringify(a2m))
  eq('meters line took the oldest takas in order', pickedA2.map((t) => t.taka_id), fifoA2.slice(0, pickedA2.length).map((t) => t.id))
  const pickedB1 = j1.takas.filter((t) => t.shade_id === cs.B1)
  check('line with takas + meters satisfies both', pickedB1.length >= 2 && sum(pickedB1.map((t) => t.sent_m)) >= 300 && (pickedB1.length === 2 || sum(pickedB1.slice(0, -1).map((t) => t.sent_m)) < 300), JSON.stringify(pickedB1.map((t) => t.sent_m)))
  eq('B1 picks follow FIFO', pickedB1.map((t) => t.taka_id), fifoB1.slice(0, pickedB1.length).map((t) => t.id))
  eq('challan lines: 4 (quality x colour)', j1.lines.map((l) => [l.nick_name, l.shade_no]), [['Alpha', 'CC2-A1'], ['Alpha', 'CC2-A2'], ['Beta', 'CC2-B1'], ['Beta', 'CC2-B2']])
  eq('challan totals', [j1.sent_takas, j1.sent_m], [j1.takas.length, sum(j1.takas.map((t) => t.sent_m))])
  check('every taka is JOB_WORK and linked to the challan', (await repo.listTakas('WHERE t.jw_challan_id=?', [jw1])).every((t) => t.status === 'JOB_WORK' && t.jw_no === 1))
  const sentMoves = await moves(j1.takas[0].taka_id)
  check('sending wrote a taka_moves row', sentMoves.at(-1).from_status === 'FOLDED' && sentMoves.at(-1).to_status === 'JOB_WORK' && sentMoves.at(-1).ref_type === 'JOB_WORK')
  const damagedSent = (await repo.listTakas('WHERE t.jw_challan_id=? AND dm.id IS NOT NULL', [jw1]))[0]
  check('a damaged taka is sent with its sellable meters', damagedSent ? damagedSent.sellable_m === j1.takas.find((t) => t.taka_id === damagedSent.id).sent_m && damagedSent.damage_m === 1.5 : true)
  const cJ = await reconciled('after sending JW-1')
  eq('FG in job work view counts the takas', [cJ.views.jobwork.takas, cJ.views.jobwork.m], [j1.sent_takas, j1.sent_m])
  eq('inventory list jobwork matches', (await repo.inventoryList('jobwork')).length, j1.sent_takas)
  check('job work list shows worker, days out and linked order fields', (await repo.listJobWorks()).every((c) => 'worker_name' in c && 'days_out' in c && 'order_no' in c))

  // --- receive: partial with changed meters
  const nA1 = pickedA1.length
  const recvRows = pickedA1.slice(0, 2).map((id, i) => ({ taka_id: id, received_m: i === 0 ? 80.5 : 85 }))
  await expectThrow('received meters cannot exceed sent', () => repo.receiveJobWork(jw1, { date: '2026-07-10', rows: [{ taka_id: pickedA1[2], received_m: 99999 }] }))
  await expectThrow('received meters must be > 0', () => repo.receiveJobWork(jw1, { date: '2026-07-10', rows: [{ taka_id: pickedA1[2], received_m: 0 }] }))
  await expectThrow('a taka that is not on the challan is rejected', () => repo.receiveJobWork(jw1, { date: '2026-07-10', rows: [{ taka_id: fifoA2.at(-1).id, received_m: 50 }] }))
  const jwRc1 = await repo.receiveJobWork(jw1, { date: '2026-07-10', ref_no: 'EMB-77', notes: 'first lot', rows: recvRows })
  j1 = await repo.getJobWork(jw1)
  eq('status PARTIAL after a partial receive', j1.status, 'PARTIAL')
  const back = await repo.listTakas('WHERE t.id=?', [pickedA1[0]])
  eq('received taka is FOLDED again, job-worked, sellable = received meters', [back[0].status, back[0].jw_type, back[0].sellable_m, back[0].jw_no], ['FOLDED', 'Embroidery', 80.5, 1])
  const sentOf = (id) => j1.takas.find((t) => t.taka_id === id).sent_m
  eq('job work shortage = sent − received', j1.shortage_m, r2(sentOf(pickedA1[0]) - 80.5 + sentOf(pickedA1[1]) - 85))
  eq('receipt history', [j1.receipts.length, j1.receipts[0].ref_no, j1.receipts[0].takas], [1, 'EMB-77', 2])
  eq('pending / received counts', [j1.received_takas, j1.pending_takas], [2, j1.sent_takas - 2])
  await expectThrow('the same taka cannot be received twice', () => repo.receiveJobWork(jw1, { date: '2026-07-11', rows: [{ taka_id: pickedA1[0], received_m: 50 }] }))
  check('receiving wrote moves back to FOLDED', (await moves(pickedA1[0])).at(-1).to_status === 'FOLDED' && (await moves(pickedA1[0])).at(-1).ref_type === 'JOB_WORK_RECEIPT')
  await reconciled('after a partial receive')
  const rep1 = await repo.shrinkageReport()
  eq('shrinkage report carries job work shortage (separate)', r2(rep1.byQuality.find((g) => g.label === 'Alpha').jwShortage), j1.shortage_m)
  eq('job work shortage is not part of the mill / folding shortage', rep1.byQuality.find((g) => g.label === 'Alpha').totalShortage, r2(rep1.rows.filter((t) => t.quality_id === qA).reduce((s, t) => s + (t.totalShortage || 0), 0)))
  // availability: plain vs job-worked, and at the job worker
  const avJ = await repo.availabilityDetail(qA, [cs.A1])
  eq('availability splits plain and job-worked', [avJ.shades[0].plain.takas, avJ.shades[0].jobworked.takas, avJ.shades[0].atJobWorker.takas], [8 - nA1, 2, 1])
  eq('availability job types', avJ.shades[0].jobTypes.map((j) => [j.label, j.takas]), [['Embroidery', 2]])
  // rest of JW-1 comes back
  const restRows = j1.takas.filter((t) => t.status === 'SENT').map((t) => ({ taka_id: t.taka_id, received_m: t.sent_m }))
  await repo.receiveJobWork(jw1, { date: '2026-07-12', rows: restRows })
  j1 = await repo.getJobWork(jw1)
  eq('status COMPLETED after the last receive', [j1.status, j1.pending_takas, j1.receipts.length], ['COMPLETED', 0, 2])
  await expectThrow('a completed challan takes no more receipts', () => repo.receiveJobWork(jw1, { date: '2026-07-13', rows: [{ taka_id: pickedA1[0], received_m: 10 }] }))
  await expectThrow('a completed challan cannot be closed short', () => repo.closeJobWork(jw1, 'x'))
  await reconciled('after JW-1 completed')
  // a job-worked taka cannot be sent again
  const plainLeftA1 = (await fifoOf(qA, cs.A1)).length
  await expectThrow('job-worked takas cannot go to job work again', () => repo.createJobWork({ job_worker_id: jwk, date: '2026-07-14', lines: [{ quality_id: qA, shade_id: cs.A1, takas: plainLeftA1 + 1 }] }))
  await expectThrow('job-worked stock cannot be asked for in a job work line', () => repo.createJobWork({ job_worker_id: jwk, date: '2026-07-14', lines: [{ quality_id: qA, shade_id: cs.A1, takas: 1, kind: 'jobworked' }] }))
  eq('inventory finished view filters plain / job-worked', [(await repo.inventoryList('finished', { quality_id: qA, jw: 'jobworked' })).length > 0, (await repo.inventoryList('finished', { quality_id: qA, jw: 'plain' })).every((t) => t.jw_type == null)], [true, true])

  // --- JW-2: close short + reopen
  const jw2 = await repo.createJobWork({ job_worker_id: jwk2, date: '2026-07-15', lines: [{ quality_id: qB, shade_id: cs.B1, takas: 3 }] })
  let j2 = await repo.getJobWork(jw2)
  eq('second challan is JW-2 with no job type', [j2.jw_no, j2.job_type], [2, null])
  await repo.receiveJobWork(jw2, { date: '2026-07-16', rows: [{ taka_id: j2.takas[0].taka_id, received_m: j2.takas[0].sent_m }] })
  eq('a receive without a job type marks the taka "Job work"', (await repo.listTakas('WHERE t.id=?', [j2.takas[0].taka_id]))[0].jw_type, 'Job work')
  await expectThrow('closing short needs a reason', () => repo.closeJobWork(jw2, '  '))
  const beforeClose = await repo.inventoryCounts()
  eq('close short returns the number of takas written off', await repo.closeJobWork(jw2, 'Lost in transit'), 2)
  j2 = await repo.getJobWork(jw2)
  eq('closed challan: status, reason, not returned', [j2.status, j2.close_reason, j2.lost_takas], ['CLOSED', 'Lost in transit', 2])
  const afterClose = await reconciled('after closing short')
  eq('NOT_RETURNED takas leave the stock', [afterClose.active, afterClose.views.jobwork.takas], [beforeClose.active - 2, beforeClose.views.jobwork.takas - 2])
  eq('the takas are NOT_RETURNED', await statusOf(j2.takas[1].taka_id), 'NOT_RETURNED')
  await expectThrow('a closed challan takes no receipts', () => repo.receiveJobWork(jw2, { date: '2026-07-17', rows: [{ taka_id: j2.takas[1].taka_id, received_m: 10 }] }))
  await expectThrow('only a closed challan can be re-opened', () => repo.reopenJobWork(jw1))
  await repo.reopenJobWork(jw2)
  j2 = await repo.getJobWork(jw2)
  eq('reopen restores JOB_WORK', [j2.status, await statusOf(j2.takas[1].taka_id), j2.pending_takas], ['PARTIAL', 'JOB_WORK', 2])
  await reconciled('after reopen')
  await repo.closeJobWork(jw2, 'Closed again')
  eq('closed again', (await repo.getJobWork(jw2)).status, 'CLOSED')
  eq('close wrote moves', (await moves(j2.takas[1].taka_id)).slice(-3).map((m) => m.to_status), ['NOT_RETURNED', 'JOB_WORK', 'NOT_RETURNED'])

  // --- orders that need job work (R-SO-3)
  const custJ = await M('customers', { name: 'Job Customer' })
  const oPlain = await repo.createOrder({ order_no: 'SO-PLAIN-A1', customer_id: custJ, quality_id: qA, lines: [{ shade_id: cs.A1, taka_count: 2 }] })
  const oJob = await repo.createOrder({ order_no: 'SO-JOB-A1', customer_id: custJ, quality_id: qA, job_work: true, job_type: 'Embroidery', job_notes: 'sleeves', lines: [{ shade_id: cs.A1, taka_count: 2 }] })
  const oOther = await repo.createOrder({ order_no: 'SO-JOB-PRINT', customer_id: custJ, quality_id: qA, job_work: true, job_type: 'printing', lines: [{ shade_id: cs.A1, taka_count: 1 }] })
  const oAnyType = await repo.createOrder({ order_no: 'SO-JOB-ANY', customer_id: custJ, quality_id: qA, job_work: true, lines: [{ shade_id: cs.A2, taka_count: 1 }] })
  eq('order carries the job work fields', (({ job_work, job_type, job_notes }) => [job_work, job_type, job_notes])(await repo.getOrder(oJob)), [1, 'Embroidery', 'sleeves'])
  eq('job fields are ignored while the switch is off', (({ job_work, job_type }) => [job_work, job_type])(await repo.getOrder(oPlain)), [0, null])
  await repo.allocateOrder(oJob)
  const jobTakas = (await repo.getOrder(oJob)).takas
  check('a job-work order takes only job-worked takas of its type', jobTakas.length === 2 && jobTakas.every((t) => t.jw_type === 'Embroidery'), JSON.stringify(jobTakas.map((t) => t.jw_type)))
  await repo.allocateOrder(oPlain)
  const plainTakas = (await repo.getOrder(oPlain)).takas
  check('a normal order takes only plain takas', plainTakas.length === 2 && plainTakas.every((t) => t.jw_type == null))
  await repo.allocateOrder(oOther)
  eq('type mismatch (Printing) allocates nothing, even case-insensitively against stock of Embroidery', (await repo.getOrder(oOther)).takas.length, 0)
  await reconciled('after job work orders')
  // link / change / unlink
  const jw3 = await repo.createJobWork({ job_worker_id: jwk, job_type: 'Embroidery', date: '2026-07-20', order_id: oOther, lines: [{ quality_id: qB, shade_id: cs.B2, takas: 2 }] })
  eq('challan created linked to an order', (await repo.getJobWork(jw3)).order_no, 'SO-JOB-PRINT')
  await expectThrow('a normal order cannot be linked', () => repo.linkJobWorkOrder(jw3, oPlain))
  await expectThrow('creating a challan for a normal order is rejected', () => repo.createJobWork({ job_worker_id: jwk, date: '2026-07-20', order_id: oPlain, lines: [{ quality_id: qB, shade_id: cs.B2, takas: 1 }] }))
  await repo.linkJobWorkOrder(jw3, oAnyType)
  eq('challan switched to another order', (await repo.getJobWork(jw3)).order_no, 'SO-JOB-ANY')
  eq('order detail lists its challans', (await repo.getOrder(oAnyType)).jobWorks.map((c) => [c.jw_label, c.sent_takas, c.pending_takas]), [['JW-3', 2, 2]])
  eq('open job orders are listed for linking', (await repo.listJobOrders()).map((o) => o.order_no).includes('SO-JOB-ANY'), true)
  await repo.linkJobWorkOrder(jw3, null)
  eq('challan unlinked', (await repo.getJobWork(jw3)).order_id, null)
  await repo.linkJobWorkOrder(jw3, oAnyType)
  await expectThrow('job work cannot be turned off while challans are linked', () => repo.updateOrder(oAnyType, { order_no: 'SO-JOB-ANY', customer_id: custJ, quality_id: qA, lines: [{ shade_id: cs.A2, taka_count: 1 }] }))
  await repo.receiveJobWork(jw3, { date: '2026-07-22', rows: (await repo.getJobWork(jw3)).takas.map((t) => ({ taka_id: t.taka_id, received_m: t.sent_m })) })
  await repo.allocateOrder(oOther) // still "printing": the Embroidery stock does not match
  eq('a type mismatch still allocates nothing', (await repo.getOrder(oOther)).takas.length, 0)
  const oAnyB = await repo.createOrder({ order_no: 'SO-JOB-ANY-B', customer_id: custJ, quality_id: qB, job_work: true, lines: [{ shade_id: cs.B2, taka_count: 2 }] })
  await repo.allocateOrder(oAnyB)
  eq('a job-work order without a type takes any job-worked stock', (await repo.getOrder(oAnyB)).takas.length, 2)
  await reconciled('after linking and allocating')

  // --- finished goods "Others" + cancel
  await expectThrow('a withdrawal needs a reason', () => repo.createFgWithdrawal({ date: '2026-08-01', lines: [{ quality_id: qA, shade_id: cs.A2, takas: 1 }] }))
  const beforeWd = await repo.inventoryCounts()
  const plainA2 = (await fifoOf(qA, cs.A2))
  const wd1 = await repo.createFgWithdrawal({ reason: 'Sample to buyer', date: '2026-08-01', notes: 'n', lines: [{ quality_id: qA, shade_id: cs.A2, takas: 2 }] })
  let w1 = await repo.getWithdrawal(wd1)
  eq('first withdrawal is WD-1', [w1.wd_no, w1.wd_label, w1.kind, w1.status, w1.takas_n], [1, 'WD-1', 'FG_OTHER', 'ACTIVE', 2])
  eq('withdrawn takas are the oldest plain ones', w1.takas.map((t) => t.id), plainA2.slice(0, 2).map((t) => t.id))
  check('they are WITHDRAWN and remember the previous status', w1.takas.every((t) => t.status === 'WITHDRAWN' && t.prev_status === 'FOLDED'))
  const afterWd = await reconciled('after FG withdrawal')
  eq('withdrawn takas leave the stock', afterWd.active, beforeWd.active - 2)
  eq('withdrawal list', (await repo.listWithdrawals({ kind: 'FG_OTHER' })).map((w) => w.wd_label), ['WD-1'])
  await repo.cancelWithdrawal(wd1)
  w1 = await repo.getWithdrawal(wd1)
  eq('cancelled withdrawal stays on record', [w1.status, w1.takas.every((t) => t.status === 'FOLDED')], ['CANCELLED', true])
  eq('stock is back exactly', (await repo.inventoryCounts()).active, beforeWd.active)
  await expectThrow('a withdrawal can be cancelled once', () => repo.cancelWithdrawal(wd1))
  check('cancel wrote moves', (await moves(w1.takas[0].id)).at(-1).from_status === 'WITHDRAWN' && (await moves(w1.takas[0].id)).at(-1).to_status === 'FOLDED')
  // job-worked stock can be withdrawn and returns to FOLDED (still job-worked)
  const wd2 = await repo.createFgWithdrawal({ reason: 'Damaged in rain', date: '2026-08-02', lines: [{ quality_id: qB, shade_id: cs.B1, takas: 1, kind: 'jobworked' }] })
  const w2 = await repo.getWithdrawal(wd2)
  check('job-worked takas can be withdrawn', w2.takas.length === 1 && w2.takas[0].jw_type != null)
  await repo.cancelWithdrawal(wd2)
  eq('…and come back job-worked', (await repo.listTakas('WHERE t.id=?', [w2.takas[0].id]))[0].jw_type != null && (await statusOf(w2.takas[0].id)) === 'FOLDED', true)
  await expectThrow('a plain-only request cannot reach job-worked stock', () => repo.createFgWithdrawal({ reason: 'x', date: '2026-08-02', lines: [{ quality_id: qB, shade_id: cs.B2, takas: 99 }] }))

  // --- grey direct sell
  const poG = await repo.createPO({ po_no: 'CC2-GREY', group_id: grp, quality_id: qA, meters: 1e6, rate: 3 })
  const mkGrey = (weaver, no, n, start = 1) => repo.createReceipt({ po_id: poG, weaver_id: weaver, challan_no: no, date: '2026-08-05', destination: 'GODOWN', branch_id: br, takas: Array.from({ length: n }, (_, i) => ({ taka_no: start + i, meter: 100 + i })) })
  const g1 = await mkGrey(fFab, 'GS-C1', 6), g2 = await mkGrey(fFab, 'GS-C2', 6), g3 = await mkGrey(fFab, 'GS-C3', 4), g4 = await mkGrey(fFas, 'GS-C4', 4)
  const gt = async (rid) => (await repo.greyGodownTakas({ receipt_ids: [rid] })).map((t) => t.id)
  const [t1, t2, t3, t4] = [await gt(g1), await gt(g2), await gt(g3), await gt(g4)]
  eq('grey picker: takas of one party only', (await repo.greyGodownTakas({ weaver_id: fFab })).every((t) => t.weaver_id === fFab), true)
  eq('godown challans filter by party', (await repo.listGodownChallans({ weaver_id: fFas })).map((c) => c.challan_no), ['GS-C4'])
  const custQuick = await M('customers', { name: 'Quick Buyer', phone: '98', city: 'Mumbai', gstin: '27aabcb9988l1z9' })
  await expectThrow('a customer is required', () => repo.createGreySale({ weaver_id: fFab, taka_ids: t1.slice(0, 2), date: '2026-08-06' }))
  await expectThrow('takas of another party are rejected', () => repo.createGreySale({ weaver_id: fFab, customer_id: custQuick, taka_ids: [...t1.slice(0, 2), t4[0]], date: '2026-08-06' }))
  await expectThrow('takas outside the chosen challans are rejected', () => repo.createGreySale({ weaver_id: fFab, receipt_ids: [g1, g2], customer_id: custQuick, taka_ids: [t1[0], t3[0]], date: '2026-08-06' }))
  const millGreyId = (await repo.listTakas("WHERE t.status='MILL_GREY'"))[0].id
  await expectThrow('a MILL_GREY taka cannot be sold as grey', () => repo.createGreySale({ weaver_id: fFab, customer_id: custQuick, taka_ids: [millGreyId], date: '2026-08-06' }))
  await expectThrow('a bad rate is rejected', () => repo.createGreySale({ weaver_id: fFab, customer_id: custQuick, taka_ids: t1.slice(0, 1), date: '2026-08-06', rate: -1 }))
  const godownBefore = (await repo.inventoryCounts()).views.godown.takas
  const gsId = await repo.createGreySale({ weaver_id: fFab, receipt_ids: [g1, g2], customer_id: custQuick, taka_ids: [...t1.slice(0, 4), ...t2.slice(0, 3)], rate: 2.5, date: '2026-08-06', notes: 'cash' })
  const gs = await repo.getGreySale(gsId)
  const gsM = sum(gs.takas.map((t) => t.grey_meter))
  eq('grey sale GS-1: counts, meters, rate → amount', [gs.gs_label, gs.takas.length, gs.meters, gs.amount], ['GS-1', 7, gsM, r2(gsM * 2.5)])
  check('takas are GREY_SOLD and linked to the sale', gs.takas.every((t) => t.status === 'GREY_SOLD' && t.grey_sale_id === gsId))
  eq('grey at our place went down by 7', (await repo.inventoryCounts()).views.godown.takas, godownBefore - 7)
  await reconciled('after the grey sale')
  eq('timeline: PO → challans → sold', gs.timeline.map((x) => x.kind), ['po', 'received', 'received', 'sold'])
  eq('timeline carries the date and branch', [gs.timeline[1].date, gs.timeline[1].sub.includes('Surat Godown')], ['2026-08-05', true])
  check('sale moves written', (await moves(gs.takas[0].id)).at(-1).to_status === 'GREY_SOLD' && (await moves(gs.takas[0].id)).at(-1).ref_type === 'GREY_SALE')
  const gs2 = await repo.createGreySale({ weaver_id: fFab, customer_id: custQuick, taka_ids: t3.slice(0, 2), date: '2026-08-07' })
  eq('second sale: GS-2 with no rate → no amount', [(await repo.getGreySale(gs2)).gs_label, (await repo.getGreySale(gs2)).amount], ['GS-2', null])
  await expectThrow('a customer used in a grey sale cannot be deleted', () => repo.removeMaster('customers', custQuick))
  await expectThrow('a sold taka cannot be sold again', () => repo.createGreySale({ weaver_id: fFab, customer_id: custQuick, taka_ids: t1.slice(0, 1), date: '2026-08-07' }))

  // --- grey Others + cancel
  const wdg = await repo.createGreyWithdrawal({ reason: 'Returned to weaver', date: '2026-08-08', taka_ids: t4.slice(0, 3) })
  const wg = await repo.getWithdrawal(wdg)
  eq('grey withdrawal WD-n, kind GREY_OTHER', [wg.wd_label, wg.kind, wg.takas.every((t) => t.status === 'WITHDRAWN' && t.prev_status === 'GODOWN_GREY')], ['WD-3', 'GREY_OTHER', true])
  await reconciled('after grey withdrawal')
  await expectThrow('grey withdrawal needs a reason', () => repo.createGreyWithdrawal({ date: '2026-08-08', taka_ids: t4.slice(3) }))
  await expectThrow('only godown grey can be withdrawn', () => repo.createGreyWithdrawal({ reason: 'x', date: '2026-08-08', taka_ids: [millGreyId] }))
  await repo.cancelWithdrawal(wdg)
  eq('grey withdrawal cancelled → back in the godown', (await repo.greyGodownTakas({ receipt_ids: [g4] })).length, 4)

  // --- sell history + withdrawals list
  await repo.closeOrder(oPlain)
  const hist = await repo.sellHistory()
  const types = new Set(hist.rows.map((r) => r.type))
  check('history has only orders (DONE) and grey sales', [...types].every((t) => t === 'ORDER' || t === 'GREY') && hist.rows.filter((r) => r.type === 'GREY').length === 2)
  check('every order in the history is DONE', (await Promise.all(hist.rows.filter((r) => r.type === 'ORDER').map((r) => repo.getOrder(r.id)))).every((o) => o.status === 'DONE'))
  eq('history totals add up', [hist.totals.entries, hist.totals.takas, hist.totals.meters], [hist.rows.length, hist.rows.reduce((s, r) => s + r.takas, 0), r2(hist.rows.reduce((s, r) => s + r.meters, 0))])
  eq('history amount counts only known rates', hist.totals.amount, gs.amount)
  eq('history filter: grey only', (await repo.sellHistory({ type: 'GREY' })).rows.length, 2)
  eq('history filter: orders only', (await repo.sellHistory({ type: 'ORDER' })).rows.every((r) => r.type === 'ORDER'), true)
  eq('history filter: customer', (await repo.sellHistory({ customer_id: custQuick })).rows.length, 2)
  eq('history filter: quality', (await repo.sellHistory({ quality_id: qB })).rows.some((r) => r.type === 'GREY'), false)
  eq('history filter: date range', (await repo.sellHistory({ type: 'GREY', from: '2026-08-07', to: '2026-08-07' })).rows.map((r) => r.no), ['GS-2'])
  check('history is newest first', hist.rows.every((r, i) => i === 0 || (hist.rows[i - 1].date || '') >= (r.date || '')))
  check('withdrawals never appear in the history', hist.rows.every((r) => !String(r.no).startsWith('WD-')))
  const wds = await repo.listWithdrawals()
  eq('withdrawals list (all)', wds.map((w) => [w.wd_label, w.status]), [['WD-3', 'CANCELLED'], ['WD-2', 'CANCELLED'], ['WD-1', 'CANCELLED']])
  eq('withdrawal filters: type, status, dates', [(await repo.listWithdrawals({ kind: 'GREY_OTHER' })).length, (await repo.listWithdrawals({ status: 'ACTIVE' })).length, (await repo.listWithdrawals({ from: '2026-08-02', to: '2026-08-02' })).length], [1, 0, 1])
  await repo.createFgWithdrawal({ reason: 'Gift', date: '2026-08-09', lines: [{ quality_id: qB, shade_id: cs.B2, takas: 1 }] })
  eq('an active withdrawal shows as Active', (await repo.listWithdrawals({ status: 'ACTIVE' })).length, 1)

  // --- every inventory detail source loads (the pages call exactly these)
  for (const v of Object.keys(repo.INVENTORY_VIEWS)) {
    for (const quality of [qA, qB]) await repo.inventoryList(v, { quality_id: quality })
    check(`inventory view "${v}" loads`, Array.isArray(await repo.inventoryList(v)))
  }
  check('dead stock loads', Array.isArray(await repo.deadStock(1, { quality_id: qA }, Date.now() + 5 * 864e5)))
  const dmg = await repo.damagedStock({ quality_id: qA })
  check('damaged stock loads', dmg.length > 0)
  eq('damaged footer total = sum of damage_m (not stock meters)', repo.damagedTotal(dmg), r2(dmg.reduce((s, t) => s + Number(t.damage_m), 0)))
  await repo.createJobWork({ job_worker_id: jwk2, job_type: 'Printing', date: '2026-08-10', lines: [{ quality_id: qA, shade_id: cs.A1, takas: 1 }] })
  const jwView = await repo.inventoryList('jobwork', { quality_id: qA })
  check('job work view rows carry challan, worker and date', jwView.length > 0 && jwView.every((t) => t.jw_no && t.jw_worker_name && t.jw_date))

  // --- batching: 300-taka saves stay within the statement budget
  const qG = await M('qualities', { original_name: 'Gamma raw', nick_name: 'Gamma', taka_length: 100 })
  const gA = await M('shades', { number: 'CC2-G1', hex: '#123456' }); await repo.addQualityColours(qG, [gA])
  await makeFolded(qG, { [gA]: 300 })
  const LIM = 20
  let st = await counted(() => repo.createJobWork({ job_worker_id: jwk, date: '2026-09-01', lines: [{ quality_id: qG, shade_id: gA, takas: 300 }] }))
  check(`job work send of 300 takas: ${st.n} statements`, st.n <= LIM, `got ${st.n}`)
  const jwBig = await repo.getJobWork(st.out)
  eq('all 300 sent', jwBig.sent_takas, 300)
  st = await counted(() => repo.receiveJobWork(st.out, { date: '2026-09-05', rows: jwBig.takas.map((t, i) => ({ taka_id: t.taka_id, received_m: r2(t.sent_m - (i % 3)) })) }))
  check(`job work receive of 300 takas: ${st.n} statements`, st.n <= LIM, `got ${st.n}`)
  eq('big receive completed the challan', (await repo.getJobWork(jwBig.id)).status, 'COMPLETED')
  st = await counted(() => repo.createFgWithdrawal({ reason: 'Bulk', date: '2026-09-06', lines: [{ quality_id: qG, shade_id: gA, takas: 300, kind: 'jobworked' }] }))
  check(`withdrawal of 300 takas: ${st.n} statements`, st.n <= LIM, `got ${st.n}`)
  await repo.cancelWithdrawal(st.out)
  const bigGrey = await repo.createReceipt({ po_id: poG, weaver_id: fFab, challan_no: 'GS-BIG', date: '2026-09-07', destination: 'GODOWN', branch_id: br, takas: Array.from({ length: 300 }, (_, i) => ({ taka_no: i + 1, meter: 100 + (i % 4) })) })
  const bigGreyIds = await gt(bigGrey)
  st = await counted(() => repo.createGreySale({ weaver_id: fFab, customer_id: custQuick, taka_ids: bigGreyIds, rate: 3, date: '2026-09-08' }))
  check(`grey sale of 300 takas: ${st.n} statements`, st.n <= LIM, `got ${st.n}`)
  const bigGrey2 = await repo.createReceipt({ po_id: poG, weaver_id: fFab, challan_no: 'GS-BIG2', date: '2026-09-07', destination: 'GODOWN', branch_id: br, takas: Array.from({ length: 300 }, (_, i) => ({ taka_no: i + 1, meter: 100 + (i % 4) })) })
  const bigGrey2Ids = await gt(bigGrey2)
  st = await counted(() => repo.createGreyWithdrawal({ reason: 'Bulk grey', date: '2026-09-09', taka_ids: bigGrey2Ids }))
  check(`grey withdrawal of 300 takas: ${st.n} statements`, st.n <= LIM, `got ${st.n}`)
  await reconciled('at the end of client changes 2')
  eq('no taka lost in this section (26 folded + 300 big + 620 grey)', (await cnt('SELECT COUNT(*) AS c FROM takas')) - BASE_TAKAS, 26 + 300 + 620)

  // ======================================================================= client changes 3: programs against weaver challans, lots
  {
    const mN = await M('mills', { name: 'CC3 Mill' }), mO = await M('mills', { name: 'CC3 Old Mill' }), mX = await M('mills', { name: 'CC3 Other Mill' })
    const cs3 = await M('shades', { number: 'CC3-A3', hex: '#445566' }); await repo.addQualityColours(qA, [cs3]); await repo.setQualityColourActive(qA, cs3, false) // inactive colour
    const poA = await repo.createPO({ po_no: 'CC3-A', group_id: grp, quality_id: qA, meters: 1e6, rate: 3 })
    const poB = await repo.createPO({ po_no: 'CC3-B', group_id: grp, quality_id: qB, meters: 1e6, rate: 3 })
    const grey = (po, weaver, no, n, dest, mill) => repo.createReceipt({ po_id: po, weaver_id: weaver, challan_no: no, date: '2026-10-01', destination: dest, ...(dest === 'MILL' ? { mill_id: mill } : { branch_id: br }), takas: Array.from({ length: n }, (_, i) => ({ taka_no: i + 1, meter: 100 + (i % 7) })) })
    const rA1 = await grey(poA, fFab, 'WC-A1', 14, 'GODOWN'), rA2 = await grey(poA, fFas, 'WC-A2', 12, 'MILL', mN), rB1 = await grey(poB, fFab, 'WC-B1', 6, 'GODOWN'), rA3 = await grey(poA, fFab, 'WC-A3', 4, 'GODOWN')
    const ids3 = async (rid) => (await repo.listTakas('WHERE t.receipt_id=?', [rid])).map((t) => t.id)
    const [tA1, tA2, tB1, tA3] = [await ids3(rA1), await ids3(rA2), await ids3(rB1), await ids3(rA3)]
    await repo.createMillChallan({ mill_id: mN, date: '2026-10-02', parts: [{ receipt_id: rA1, taka_ids: tA1 }, { receipt_id: rB1, taka_ids: tB1 }] })
    await repo.createMillChallan({ mill_id: mX, date: '2026-10-02', parts: [{ receipt_id: rA3, taka_ids: tA3 }] })

    // --- picker lists
    eq('qualities with grey at the mill', (await repo.qualitiesAtMill(mN)).map((x) => [x.nick_name, x.takas]), [['Alpha', 26], ['Beta', 6]])
    const wl = await repo.millChallansForProgram(mN, qA)
    eq('weavers of Alpha at the mill (incl. the direct one)', wl.map((w) => w.weaver_name).sort(), ['Ganesh Fabrics', 'Ganesh Fashion'])
    const chA1 = wl.find((w) => w.weaver_name === 'Ganesh Fabrics').challans[0], chA2 = wl.find((w) => w.weaver_name === 'Ganesh Fashion').challans[0]
    eq('a challan sent by our mill challan shows its sub no, a direct one is marked', [chA1.challan_no, chA1.direct, /^\d+[A-Z]$/.test(chA1.sub_no), chA1.takas, chA2.challan_no, chA2.direct, chA2.sub_no], ['WC-A1', false, true, 14, 'WC-A2', true, null])
    eq('Beta has one weaver', (await repo.millChallansForProgram(mN, qB)).map((w) => w.challans.map((c) => c.challan_no)), [['WC-B1']])
    eq('another mill sees only its own grey', (await repo.millChallansForProgram(mX, qA))[0].challans.map((c) => c.challan_no), ['WC-A3'])
    eq('takas of one challan at the mill', (await repo.programTakasOfReceipt(mN, rA2)).length, 12)

    // --- createProgram (new): 2 qualities, 3 weaver challans, 2 shades in one challan
    const cnt3 = async () => [await cnt('SELECT COUNT(*) AS c FROM programs'), await cnt('SELECT COUNT(*) AS c FROM program_lines'), await cnt("SELECT COUNT(*) AS c FROM takas WHERE status='IN_DYEING'")]
    const before3 = await cnt3()
    const bad3 = (name, parts, mill = mN) => expectThrow(name, () => repo.createProgram({ mill_id: mill, date: '2026-10-05', parts }))
    await bad3('a taka at another mill is rejected', [{ receipt_id: rA3, lines: [{ shade_id: cs.A1, taka_ids: [tA3[0]] }] }])
    await bad3('a taka from another receipt is rejected', [{ receipt_id: rA1, lines: [{ shade_id: cs.A1, taka_ids: [tA2[0]] }] }])
    await bad3('an inactive colour is rejected', [{ receipt_id: rA1, lines: [{ shade_id: cs3, taka_ids: [tA1[0]] }] }])
    await bad3('a colour that is not linked to the quality is rejected', [{ receipt_id: rA1, lines: [{ shade_id: cs.B1, taka_ids: [tA1[0]] }] }])
    await bad3('a duplicate taka is rejected', [{ receipt_id: rA1, lines: [{ shade_id: cs.A1, taka_ids: [tA1[0]] }, { shade_id: cs.A2, taka_ids: [tA1[0]] }] }])
    await bad3('no takas is rejected', [{ receipt_id: rA1, lines: [{ shade_id: cs.A1, taka_ids: [] }] }])
    await bad3('a bad part after a good one rolls everything back', [{ receipt_id: rA1, lines: [{ shade_id: cs.A1, taka_ids: [tA1[0]] }] }, { receipt_id: rA2, lines: [{ shade_id: cs.B1, taka_ids: [tA2[0]] }] }])
    await expectThrow('a program needs a mill', () => repo.createProgram({ date: '2026-10-05', parts: [{ receipt_id: rA1, lines: [{ shade_id: cs.A1, taka_ids: [tA1[0]] }] }] }))
    eq('failed saves leave no rows', await cnt3(), before3)
    const pg = await repo.createProgram({ mill_id: mN, date: '2026-10-05', notes: 'multi', parts: [
      { receipt_id: rA1, lines: [{ shade_id: cs.A1, taka_ids: tA1.slice(0, 6) }, { shade_id: cs.A2, taka_ids: tA1.slice(6, 10) }] },
      { receipt_id: rA2, lines: [{ shade_id: cs.A1, taka_ids: tA2.slice(0, 10) }] },
      { receipt_id: rB1, lines: [{ shade_id: cs.B1, taka_ids: tB1 }] },
    ] })
    let P = await repo.getProgram(pg)
    eq('program lines: one per receipt + shade', P.lines.map((l) => [l.weaver_challan, l.shade_no, l.taka_count]), [['WC-A1', 'CC2-A1', 6], ['WC-A1', 'CC2-A2', 4], ['WC-A2', 'CC2-A1', 10], ['WC-B1', 'CC2-B1', 6]])
    eq('program header: first line quality, 2 qualities listed, 3 challans, 26 takas, PENDING', [P.quality_id, P.nick_name.split(',').sort(), Number(P.challan_count), P.total_takas, P.status], [qA, ['Alpha', 'Beta'], 3, 26, 'PENDING'])
    check('takas are IN_DYEING on their line', P.takas.length === 26 && P.takas.every((t) => t.status === 'IN_DYEING' && t.program_line_id));
    check('line carries quality, party and direct / sub info', P.lines[0].quality_nick === 'Alpha' && P.lines[0].weaver_name === 'Ganesh Fabrics' && /^\d+[A-Z]$/.test(P.lines[0].sub_nos) && P.lines[2].weaver_destination === 'MILL')
    check('issuing wrote moves', (await moves(P.takas[0].id)).at(-1).to_status === 'IN_DYEING')
    eq('challans with nothing left are no longer listed (Beta)', await repo.millChallansForProgram(mN, qB), [])
    eq('grey left at the mill for Alpha', (await repo.millChallansForProgram(mN, qA)).flatMap((w) => w.challans).map((c) => [c.challan_no, c.takas]).sort(), [['WC-A1', 4], ['WC-A2', 2]])

    // --- multi-quality regression
    eq('program list shows all qualities', (await repo.listPrograms()).find((x) => x.id === pg).nick_name.split(',').sort(), ['Alpha', 'Beta'])
    const lcA = (await repo.listQualityColours(qA)).find((c) => c.shade_id === cs.A1), lcB = (await repo.listQualityColours(qB)).find((c) => c.shade_id === cs.B1)
    eq('"last program" of a colour works for both qualities', [lcA.last_program, lcB.last_program], ['2026-10-05', '2026-10-05'])
    await expectThrow('a colour used by a program line cannot be unlinked from its quality', () => repo.removeQualityColour(qB, cs.B1))
    eq('shrinkage / availability / inventory still work', [Array.isArray((await repo.shrinkageReport()).rows), (await repo.availabilityDetail(qB, [cs.B1])).shades[0].dyeing.takas, (await repo.inventoryList('dyeing', { quality_id: qB })).length], [true, 6, 6])
    await reconciled('after issuing a multi-quality program')

    // --- addToProgram: extends a line, adds a line
    await repo.addToProgram(pg, [{ receipt_id: rA1, lines: [{ shade_id: cs.A1, taka_ids: tA1.slice(10, 12) }] }, { receipt_id: rA2, lines: [{ shade_id: cs.A2, taka_ids: tA2.slice(10, 12) }] }])
    P = await repo.getProgram(pg)
    eq('adding extends the same receipt + shade line and adds a new one', P.lines.map((l) => [l.weaver_challan, l.shade_no, l.taka_count]), [['WC-A1', 'CC2-A1', 8], ['WC-A1', 'CC2-A2', 4], ['WC-A2', 'CC2-A1', 10], ['WC-B1', 'CC2-B1', 6], ['WC-A2', 'CC2-A2', 2]])
    await expectThrow('adding a taka of another mill is rejected', () => repo.addToProgram(pg, [{ receipt_id: rA3, lines: [{ shade_id: cs.A1, taka_ids: [tA3[0]] }] }]))
    await expectThrow('adding to an unknown program is rejected', () => repo.addToProgram(99999, [{ receipt_id: rA1, lines: [{ shade_id: cs.A1, taka_ids: [tA1[12]] }] }]))

    // --- receipt by weaver challan with lots
    const lineId = (receipt, shade) => P.lines.find((l) => l.receipt_id === receipt && l.shade_id === shade).id
    const takasOfLine = (id) => P.takas.filter((t) => t.program_line_id === id)
    const L_A1 = lineId(rA1, cs.A1), L_A2 = lineId(rA1, cs.A2)
    const fin = (t) => ({ id: t.id, finished_meter: r2(Number(t.grey_meter) - 2) })
    await expectThrow('a lot number is required on every received line', () => repo.createFinishedReceipt({ program_id: pg, challan_no: 'M-1', date: '2026-10-10', lines: [{ program_line_id: L_A1, lot_no: '', rows: takasOfLine(L_A1).slice(0, 2).map(fin) }] }))
    await expectThrow('finished meters are required', () => repo.createFinishedReceipt({ program_id: pg, challan_no: 'M-1', date: '2026-10-10', lines: [{ program_line_id: L_A1, lot_no: 'L-1', rows: [{ id: takasOfLine(L_A1)[0].id }] }] }))
    await expectThrow('a line of another program is rejected', () => repo.createFinishedReceipt({ program_id: pg, challan_no: 'M-1', date: '2026-10-10', lines: [{ program_line_id: 999999, lot_no: 'L-1', rows: takasOfLine(L_A1).slice(0, 1).map(fin) }] }))
    await expectThrow('a taka received on the wrong line is rejected', () => repo.createFinishedReceipt({ program_id: pg, challan_no: 'M-1', date: '2026-10-10', lines: [{ program_line_id: L_A1, lot_no: 'L-1', rows: takasOfLine(L_A2).slice(0, 1).map(fin) }] }))
    eq('failed receipts changed nothing', [await cnt('SELECT COUNT(*) AS c FROM finished_receipts WHERE challan_no=\'M-1\''), (await repo.getProgram(pg)).takas.filter((t) => t.status === 'IN_DYEING').length], [0, 30])
    const fr1 = await repo.createFinishedReceipt({ program_id: pg, challan_no: 'M-1', date: '2026-10-10', lines: [
      { program_line_id: L_A1, lot_no: 'L-1', rows: takasOfLine(L_A1).slice(0, 3).map(fin) },
      { program_line_id: L_A2, lot_no: 'L-2', rows: takasOfLine(L_A2).map(fin) },
    ] })
    P = await repo.getProgram(pg)
    eq('partial receipt: status PARTIAL, received takas', [P.status, Number(P.received_takas)], ['PARTIAL', 7])
    eq('lots stored on the lines and on the takas', [P.lines.find((l) => l.id === L_A1).lot_no, P.lines.find((l) => l.id === L_A2).lot_no, takasOfLine(L_A1)[0].id && (await repo.listTakas('WHERE t.id=?', [takasOfLine(L_A1)[0].id]))[0].lot_no, (await repo.listTakas('WHERE t.id=?', [takasOfLine(L_A2)[0].id]))[0].lot_no], ['L-1', 'L-2', 'L-1', 'L-2'])
    eq('pending per line is right', P.lines.filter((l) => l.id === L_A1 || l.id === L_A2).map((l) => [Number(l.allocated) - Number(l.received)]), [[5], [0]])
    eq('receipt list shows the lots', (await repo.listFinishedReceipts('WHERE fr.id=?', [fr1]))[0].lots.split(',').sort(), ['L-1', 'L-2'])
    check('moves note the lot', (await moves(takasOfLine(L_A1)[0].id)).at(-1).note.includes('L-1'))
    const rest = takasOfLine(L_A1).slice(3)
    await expectThrow('a different lot for the same line is rejected', () => repo.createFinishedReceipt({ program_id: pg, challan_no: 'M-2', date: '2026-10-11', lines: [{ program_line_id: L_A1, lot_no: 'L-9', rows: rest.slice(0, 1).map(fin) }] }))
    await repo.createFinishedReceipt({ program_id: pg, challan_no: 'M-2', date: '2026-10-11', lines: [{ program_line_id: L_A1, lot_no: 'L-1', rows: rest.map(fin) }] })
    eq('the same lot on a later receipt is accepted', (await repo.listTakas('WHERE t.id=?', [rest[0].id]))[0].lot_no, 'L-1')
    const other = P.lines.filter((l) => ![L_A1, L_A2].includes(l.id))
    const all2 = await repo.createFinishedReceipt({ program_id: pg, challan_no: 'M-3', date: '2026-10-12', lines: other.map((l, i) => ({ program_line_id: l.id, lot_no: i % 2 ? 'L-1' : `L-${i + 5}`, rows: takasOfLine(l.id).map(fin) })) })
    P = await repo.getProgram(pg)
    eq('program is Done after the last receipt', [P.status, Number(P.received_takas), P.total_takas], ['DONE', 30, 30])
    await expectThrow('a Done program takes no more takas', () => repo.addToProgram(pg, [{ receipt_id: rA1, lines: [{ shade_id: cs.A1, taka_ids: [tA1[12]] }] }]))
    check('all takas carry a lot', (await repo.listTakas('WHERE pl.program_id=?', [pg])).every((t) => t.lot_no && t.status === 'FINISHED'))
    eq('shrinkage numbers use the finished meters (mill shortage 2 m per taka)', r2((await repo.shrinkageReport()).rows.filter((t) => t.program_id === pg).reduce((s, t) => s + t.millShortage, 0)), 60)
    await reconciled('after the lot-wise receipts')

    // --- old programs (old signature, no weaver challan) can still be received, one lot per line
    const poO = await repo.createPO({ po_no: 'CC3-OLD', group_id: grp, quality_id: qA, meters: 1e6, rate: 3 })
    const rO = await grey(poO, fFab, 'WC-OLD', 6, 'MILL', mO)
    const pgOld = await repo.createProgram({ mill_id: mO, quality_id: qA, date: '2026-10-06', lines: [{ shade_id: cs.A1, taka_count: 4 }, { shade_id: cs.A2, taka_count: 2 }] })
    let PO = await repo.getProgram(pgOld)
    eq('old-style program: lines have no weaver challan, quality is the program\'s', [PO.lines.map((l) => l.receipt_id), PO.lines.map((l) => l.quality_nick), PO.nick_name], [[null, null], ['Alpha', 'Alpha'], 'Alpha'])
    await repo.createFinishedReceipt({ program_id: pgOld, challan_no: 'OLD-1', date: '2026-10-12', lines: PO.lines.map((l, i) => ({ program_line_id: l.id, lot_no: `OLD-LOT-${i}`, rows: PO.takas.filter((t) => t.program_line_id === l.id).map(fin) })) })
    PO = await repo.getProgram(pgOld)
    eq('old program received with one lot per line', [PO.status, PO.lines.map((l) => l.lot_no)], ['DONE', ['OLD-LOT-0', 'OLD-LOT-1']])
    // the row-only receipt (old signature) still works and copies a lot already set on the line
    const pgOld2 = await repo.createProgram({ mill_id: mO, quality_id: qA, date: '2026-10-07', lines: [] }).catch(() => null)
    check('old signature without lines still rejects an empty program', pgOld2 === null)
    await reconciled('after old-style programs')

    // --- batching: a 500-taka program issue and receipt
    const qBig3 = await M('qualities', { original_name: 'Delta raw', nick_name: 'Delta', taka_length: 100 })
    const dA = await M('shades', { number: 'CC3-D1', hex: '#111122' }), dB = await M('shades', { number: 'CC3-D2', hex: '#221111' })
    await repo.addQualityColours(qBig3, [dA, dB])
    const poD = await repo.createPO({ po_no: 'CC3-D', group_id: grp, quality_id: qBig3, meters: 1e7, rate: 3 })
    const rD = await repo.createReceipt({ po_id: poD, weaver_id: fFab, challan_no: 'WC-BIG', date: '2026-10-08', destination: 'MILL', mill_id: mN, takas: Array.from({ length: 500 }, (_, i) => ({ taka_no: i + 1, meter: 95 + (i % 10) })) })
    const tD = await ids3(rD)
    let st3 = await counted(() => repo.createProgram({ mill_id: mN, date: '2026-10-08', parts: [{ receipt_id: rD, lines: [{ shade_id: dA, taka_ids: tD.slice(0, 250) }, { shade_id: dB, taka_ids: tD.slice(250) }] }] }))
    check(`program issue of 500 takas: ${st3.n} statements`, st3.n <= 20, `got ${st3.n}`)
    const PD = await repo.getProgram(st3.out)
    st3 = await counted(() => repo.createFinishedReceipt({ program_id: st3.out, challan_no: 'BIG-M', date: '2026-10-09', lines: PD.lines.map((l) => ({ program_line_id: l.id, lot_no: `D-${l.shade_no}`, rows: PD.takas.filter((t) => t.program_line_id === l.id).map((t) => ({ id: t.id, finished_meter: r2(t.grey_meter - 1.5) })) })) }))
    check(`mill receipt of 500 takas: ${st3.n} statements`, st3.n <= 20, `got ${st3.n}`)
    eq('big program received', (await repo.getProgram(PD.id)).status, 'DONE')
    await reconciled('at the end of client changes 3')
  }

  // ======================================================================= client changes 4: sell to order, order stock, In mill, lot-sharing receipts
  {
    const qS = await M('qualities', { original_name: 'Sigma raw', nick_name: 'Sigma', taka_length: 100 })
    const S = {}
    for (const [k, hex] of [['S1', '#334455'], ['S2', '#554433'], ['S3', '#335544']]) S[k] = await M('shades', { number: `CC4-${k}`, hex })
    await repo.addQualityColours(qS, [S.S1, S.S2, S.S3])
    await makeFolded(qS, { [S.S1]: 8, [S.S2]: 4 })
    const custS = await M('customers', { name: 'CC4 Customer' })
    const stat = async (ids) => (await client.all(`SELECT id, status, order_id FROM takas WHERE id IN (${ids.map(() => '?').join(',')})`, ids)).map((r) => [r.status, r.order_id])
    const readyPlain = async (shade) => (await repo.listTakas("WHERE t.status='FOLDED' AND p.quality_id=? AND pl.shade_id=? AND t.jw_type IS NULL", [qS, shade]))

    // --- previewOrderAllocation: read-only, plain stock only, oldest first, whole takas
    const oN = await repo.createOrder({ order_no: 'CC4-N', customer_id: custS, quality_id: qS, lines: [{ shade_id: S.S1, taka_count: 3 }, { shade_id: S.S2, meters: 150 }] })
    const lnN = (await repo.getOrder(oN)).lines
    const pre = await repo.previewOrderAllocation(oN)
    const r1S1 = await readyPlain(S.S1), r1S2 = await readyPlain(S.S2)
    eq('preview: line 1 picks the 3 oldest plain takas', pre.lines[0].picked.map((t) => t.id), r1S1.slice(0, 3).map((t) => t.id))
    const needSum = sum(pre.lines[1].picked.map((t) => Number(t.sellable_m)))
    check('preview: a meters line takes whole takas and may overshoot', needSum >= 150 && sum(pre.lines[1].picked.slice(0, -1).map((t) => Number(t.sellable_m))) < 150, `got ${needSum}`)
    eq('preview: shows available stock, pending and covered', [pre.lines[0].available.takas, pre.lines[0].pending.takas, pre.lines[0].covered, pre.lines[0].short], [8, 3, true, false])
    eq('preview is read-only', await stat(pre.lines.flatMap((l) => l.picked.map((t) => t.id))), pre.lines.flatMap((l) => l.picked.map(() => ['FOLDED', null])))
    const preW = await repo.previewOrderAllocation(oN, [{ order_line_id: lnN[0].id, takas: 1 }, { order_line_id: lnN[1].id, takas: 0, meters: 0 }])
    eq('preview with changed wants: 1 taka, and a line set to 0 gets nothing', [preW.lines[0].gotT, preW.lines[1].gotT, preW.lines[0].covered], [1, 0, false])
    await expectThrow('preview rejects more than pending', () => repo.previewOrderAllocation(oN, [{ order_line_id: lnN[0].id, takas: 4 }]))
    await expectThrow('preview rejects a line of another order', () => repo.previewOrderAllocation(oN, [{ order_line_id: 999999, takas: 1 }]))

    // --- allocateOrderLines: partial give keeps the order open; SOLD + order_id + moves
    const part = await repo.allocateOrderLines(oN, [{ order_line_id: lnN[0].id, takas: 1 }])
    eq('partial give: 1 taka, order stays open', [part.allocated, part.done, (await repo.getOrder(oN)).status], [1, false, 'OPEN'])
    const soldIds = (await repo.getOrder(oN)).takas.map((t) => t.id)
    eq('SOLD with the order id', await stat(soldIds), [['SOLD', oN]])
    const mv = (await moves(soldIds[0])).at(-1)
    eq('a taka move with ref ORDER', [mv.from_status, mv.to_status, mv.ref_type, mv.ref_id], ['FOLDED', 'SOLD', 'ORDER', oN])
    // a failed save leaves no changes (second line asks for more than is pending)
    const beforeFail = await cnt("SELECT COUNT(*) AS c FROM takas WHERE status='SOLD'")
    await expectThrow('an invalid line fails the whole save', () => repo.allocateOrderLines(oN, [{ order_line_id: lnN[0].id, takas: 1 }, { order_line_id: lnN[1].id, takas: 99, meters: 99999 }]))
    eq('a failed save leaves no changes', [await cnt("SELECT COUNT(*) AS c FROM takas WHERE status='SOLD'"), (await repo.getOrder(oN)).takas.length], [beforeFail, 1])
    const rest = await repo.allocateOrderLines(oN, [{ order_line_id: lnN[0].id, takas: 2 }, { order_line_id: lnN[1].id, meters: 150 }])
    eq('the rest is given: the order closes only now', [rest.done, (await repo.getOrder(oN)).status, (await repo.getOrder(oN)).takas.length >= 5], [true, 'DONE', true])
    await expectThrow('a completed order takes no more', () => repo.allocateOrderLines(oN, [{ order_line_id: lnN[0].id, takas: 1 }]))
    check('the closed order is in the sell history', (await repo.sellHistory({ type: 'ORDER' })).rows.some((r) => String(r.ref || r.order_no || r.no || '').includes('CC4-N') || JSON.stringify(r).includes('CC4-N')))

    // --- not enough stock: the line stays pending
    const oShort = await repo.createOrder({ order_no: 'CC4-SHORT', customer_id: custS, quality_id: qS, lines: [{ shade_id: S.S2, taka_count: 20 }] })
    const lnShort = (await repo.getOrder(oShort)).lines
    const haveS2 = (await readyPlain(S.S2)).length
    const pShort = await repo.previewOrderAllocation(oShort)
    eq('preview says short when stock is not enough', [pShort.lines[0].short, pShort.lines[0].gotT, pShort.lines[0].covered], [true, haveS2, false])
    const gShort = await repo.allocateOrderLines(oShort, [{ order_line_id: lnShort[0].id, takas: 20 }])
    eq('confirming with what is available leaves the line pending', [gShort.allocated, gShort.short, gShort.done, (await repo.getOrder(oShort)).status], [haveS2, 1, false, 'OPEN'])

    // --- regression: Auto-allocate = the same core with the full pending amounts
    const oAuto = await repo.createOrder({ order_no: 'CC4-AUTO', customer_id: custS, quality_id: qS, lines: [{ shade_id: S.S1, taka_count: 2 }] })
    const preAuto = await repo.previewOrderAllocation(oAuto)
    const resAuto = await repo.allocateOrder(oAuto)
    eq('Auto-allocate gives exactly the previewed takas', [resAuto, (await repo.getOrder(oAuto)).takas.map((t) => t.id), (await repo.getOrder(oAuto)).status], [{ allocated: 2, short: 0 }, preAuto.lines[0].picked.map((t) => t.id), 'DONE'])
    const oAuto2 = await repo.createOrder({ order_no: 'CC4-AUTO2', customer_id: custS, quality_id: qS, lines: [{ shade_id: S.S3, taka_count: 1 }] })
    eq('Auto-allocate with no stock allocates nothing and stays open', [await repo.allocateOrder(oAuto2), (await repo.getOrder(oAuto2)).status], [{ allocated: 0, short: 1 }, 'OPEN'])

    // --- job-work orders: only job-worked takas of the named type
    await makeFolded(qS, { [S.S3]: 6 })
    const jwkS = await M('job_workers', { name: 'CC4 Embroidery' })
    const jwS = await repo.createJobWork({ job_worker_id: jwkS, job_type: 'Embroidery', date: '2026-10-20', lines: [{ quality_id: qS, shade_id: S.S3, takas: 3 }] })
    const mid = await repo.orderAvailability(oAuto2)
    eq('stock at the job worker is listed with the challan', [mid.detail.shades[0].atJobWorker.takas, mid.detail.shades[0].jwChallans.length], [3, 1])
    await repo.receiveJobWork(jwS, { date: '2026-10-22', rows: (await repo.getJobWork(jwS)).takas.map((t) => ({ taka_id: t.taka_id, received_m: t.sent_m })) })
    const oJ = await repo.createOrder({ order_no: 'CC4-JOB', customer_id: custS, quality_id: qS, job_work: true, job_type: 'embroidery', lines: [{ shade_id: S.S3, taka_count: 2 }] })
    const oJx = await repo.createOrder({ order_no: 'CC4-JOB-X', customer_id: custS, quality_id: qS, job_work: true, job_type: 'Printing', lines: [{ shade_id: S.S3, taka_count: 1 }] })
    const pJ = await repo.previewOrderAllocation(oJ), pJx = await repo.previewOrderAllocation(oJx)
    check('job-work order previews only job-worked takas of its type', pJ.lines[0].picked.length === 2 && pJ.lines[0].picked.every((t) => String(t.jw_type).toLowerCase() === 'embroidery'))
    eq('a job type that does not match has no eligible stock', [pJx.lines[0].available.takas, pJx.lines[0].gotT, pJx.lines[0].short], [0, 0, true])
    const oPlainS3 = await repo.createOrder({ order_no: 'CC4-PLAIN-S3', customer_id: custS, quality_id: qS, lines: [{ shade_id: S.S3, taka_count: 5 }] })
    const pP = await repo.previewOrderAllocation(oPlainS3)
    check('a normal order previews only plain takas (3 plain, the other 3 are job-worked)', pP.lines[0].available.takas === 3 && pP.lines[0].picked.every((t) => t.jw_type == null))

    // --- program receipts as the new flow sends them: two lines sharing one lot text, all-or-nothing
    const poK = await repo.createPO({ po_no: 'CC4-K', group_id: grp, quality_id: qS, meters: 1e6, rate: 3 })
    const grey4 = (no, n) => repo.createReceipt({ po_id: poK, weaver_id: fFab, challan_no: no, date: '2026-10-21', destination: 'MILL', mill_id: m1, takas: Array.from({ length: n }, (_, i) => ({ taka_no: i + 1, meter: 100 + i })) })
    const rK1 = await grey4('CC4-WC1', 4), rK2 = await grey4('CC4-WC2', 6)
    const idsK = async (rid) => (await repo.listTakas('WHERE t.receipt_id=?', [rid])).map((t) => t.id)
    const [tK1, tK2] = [await idsK(rK1), await idsK(rK2)]
    const pgLot = await repo.createProgram({ mill_id: m1, date: '2026-10-21', notes: 'cc4 lot program', parts: [{ receipt_id: rK1, lines: [{ shade_id: S.S1, taka_ids: tK1 }] }] })
    const pgShare = await repo.createProgram({ mill_id: m1, date: '2026-10-21', notes: 'cc4 shared lot', parts: [{ receipt_id: rK2, lines: [{ shade_id: S.S1, taka_ids: tK2.slice(0, 3) }, { shade_id: S.S2, taka_ids: tK2.slice(3) }] }] })
    const Pl = await repo.getProgram(pgLot), Ps = await repo.getProgram(pgShare)
    const finK = (t) => ({ id: t.id, finished_meter: r2(Number(t.grey_meter) - 1) })
    const takasL = (P, line) => P.takas.filter((t) => t.program_line_id === line.id)
    // the "In mill" list: both programs, grouped by the mill, nothing else with a received program
    let inMill = await repo.inMillPrograms(new Date('2026-10-26T12:00:00').getTime())
    const flat = inMill.flatMap((g) => g.programs)
    check('In mill lists only programs with takas in dyeing', flat.every((x) => x.pending > 0) && flat.some((x) => x.id === pgLot) && flat.some((x) => x.id === pgShare))
    eq('In mill: grouped by mill, pending counts and days', [inMill.find((g) => g.mill_id === m1).programs.find((x) => x.id === pgLot).pending, inMill.find((g) => g.mill_id === m1).programs.find((x) => x.id === pgLot).days, inMill.find((g) => g.mill_id === m1).programs.find((x) => x.id === pgShare).colours.map((c) => c.takas).sort()], [4, 5, [3, 3]])
    // missing meters rejected, and a bad second line rolls the first back
    const beforeK = [await cnt('SELECT COUNT(*) AS c FROM finished_receipts'), await cnt("SELECT COUNT(*) AS c FROM takas WHERE status='IN_DYEING'")]
    await expectThrow('a missing finished meter is rejected', () => repo.createFinishedReceipt({ program_id: pgShare, challan_no: 'CC4-M1', date: '2026-10-22', lines: [{ program_line_id: Ps.lines[0].id, lot_no: 'SHARED-1', rows: takasL(Ps, Ps.lines[0]).map(finK) }, { program_line_id: Ps.lines[1].id, lot_no: 'SHARED-1', rows: [{ id: takasL(Ps, Ps.lines[1])[0].id }] }] }))
    eq('nothing changed after the failed receipt (one transaction)', [await cnt('SELECT COUNT(*) AS c FROM finished_receipts'), await cnt("SELECT COUNT(*) AS c FROM takas WHERE status='IN_DYEING'")], beforeK)
    await repo.createFinishedReceipt({ program_id: pgShare, challan_no: 'CC4-M2', date: '2026-10-22', lines: Ps.lines.map((l) => ({ program_line_id: l.id, lot_no: 'SHARED-1', rows: takasL(Ps, l).map(finK) })) })
    const Ps2 = await repo.getProgram(pgShare)
    eq('two lines share one lot text', [Ps2.lines.map((l) => l.lot_no), Ps2.status, [...new Set(Ps2.takas.map((t) => t.lot_no))]], [['SHARED-1', 'SHARED-1'], 'DONE', ['SHARED-1']])
    // a locked lot is honoured; partial receipt leaves the rest in the mill
    await repo.createFinishedReceipt({ program_id: pgLot, challan_no: 'CC4-M3', date: '2026-10-22', lines: [{ program_line_id: Pl.lines[0].id, lot_no: 'LOT-X', rows: takasL(Pl, Pl.lines[0]).slice(0, 2).map(finK) }] })
    await expectThrow('a locked lot cannot be changed by a later receipt', () => repo.createFinishedReceipt({ program_id: pgLot, challan_no: 'CC4-M4', date: '2026-10-23', lines: [{ program_line_id: Pl.lines[0].id, lot_no: 'LOT-Y', rows: takasL(Pl, Pl.lines[0]).slice(2, 3).map(finK) }] }))
    inMill = await repo.inMillPrograms()
    const rowLot = inMill.flatMap((g) => g.programs).find((x) => x.id === pgLot)
    eq('In mill after a partial receipt: pending 2 of 4, lot shown, a fully received program is gone', [rowLot.pending, rowLot.issued, rowLot.received, rowLot.lots, inMill.flatMap((g) => g.programs).some((x) => x.id === pgShare)], [2, 4, 2, ['LOT-X'], false])

    // --- order detail stock (R-SO-5)
    const oStock = await repo.createOrder({ order_no: 'CC4-STOCK', customer_id: custS, quality_id: qS, lines: [{ shade_id: S.S1, taka_count: 50 }, { shade_id: S.S2, taka_count: 1 }] })
    const av = await repo.orderAvailability(oStock)
    const l1 = av.lines[0], l2 = av.lines[1]
    const s1 = av.detail.shades.find((x) => x.shade_id === S.S1)
    eq('order stock: eligible plain stock, short by and covered (S2 was used up by the short order)', [l1.eligible.takas, l1.pending.takas, l1.shortT, l1.covered, l2.covered, l2.shortT], [(await readyPlain(S.S1)).length, 50, 50 - (await readyPlain(S.S1)).length, false, false, 1])
    eq('order stock: in dyeing shows the program with its lot, finished-to-fold counts', [s1.dyeing.takas, s1.programs[0].lots, s1.unfolded.takas], [2, ['LOT-X'], 3 + 2])
    check('order stock: quality-level grey and open POs are present', av.detail.greyAtMill && av.detail.greyAtPlace && typeof av.detail.openPos.count === 'number')
    await reconciled('at the end of client changes 4')
  }

  // --- client changes 5: firms / associated parties, GST numbers, master details, order rate + payments
  {
    // GST number on firms (weaver groups) and associated parties, trimmed + upper-case like the other parties
    await M('weaver_groups', { id: grp, name: 'Ganesh', gstin: ' 24aaacg1234f1z5 ' })
    const fw = await M('weavers', { group_id: grp, name: 'GST Party', gstin: '27aabcb9988l1z9' })
    const gRow = (await repo.listWeaverGroups()).find((g) => g.id === grp)
    eq('firm GST number saved trimmed and upper-case', [gRow.gstin, gRow.firms.find((w) => w.id === fw).gstin], ['24AAACG1234F1Z5', '27AABCB9988L1Z9'])
    eq('firm GST number is optional', (await repo.listWeaverGroups()).find((g) => g.id === other).gstin, null)
    let delMsg = ''
    try { await repo.removeMaster('weaver_groups', grp) } catch (e) { delMsg = e.message }
    check('deleting a firm in use names its associated parties', /associated parties/.test(delMsg), delMsg)
    await repo.removeMaster('weavers', fw)

    // settings: default payment reminder
    eq('default payment reminder is 60 days', await repo.getPaymentDays(), 60)
    await expectThrow('payment reminder must be whole days >= 1', () => repo.setPaymentDays(0))
    eq('payment reminder saved', await repo.setPaymentDays(90), 90)

    // rate + reminder days on orders
    await expectThrow('order rate must be > 0', () => repo.createOrder({ order_no: 'SO-RATE0', customer_id: cust, quality_id: q, rate: '0', lines: [{ shade_id: sh['37'], taka_count: 1 }] }))
    await expectThrow('order reminder days must be whole', () => repo.createOrder({ order_no: 'SO-DAYS', customer_id: cust, quality_id: q, rate: 10, payment_days: 1.5, lines: [{ shade_id: sh['37'], taka_count: 1 }] }))
    const oNew = await repo.createOrder({ order_no: 'SO-PAY', customer_id: cust, quality_id: q, rate: '12.5', lines: [{ shade_id: sh['37'], taka_count: 2 }, { shade_id: sh['39'], meters: 150 }] })
    let op = (await repo.getOrder(oNew)).payment
    eq('new order: rate, default days, expected = (2 takas x 100 m + 150 m) x rate, nothing billable yet', [op.rate, op.days, op.own_days, op.estimated, op.expected_m, op.expected_amount, op.dispatched_amount, op.due], [12.5, 90, false, true, 350, 4375, 0, false])

    // SO-ALLOC (section 18) was dispatched today without a rate; giving it a rate keeps its (locked) lines
    let before = await repo.getOrder(oa)
    eq('old order without a rate: amounts unknown, reminder counts from the dispatch', [before.payment.rate, before.payment.outstanding, before.payment.since, before.payment.due], [null, null, repo.today(), false])
    await repo.updateOrder(oa, { order_no: before.order_no, date: before.date, customer_id: before.customer_id, quality_id: before.quality_id, notes: before.notes, rate: 20 })
    before = await repo.getOrder(oa)
    eq('rate added after allocation; lines kept', [before.rate, before.lines.length, before.payment.dispatched_amount, before.payment.outstanding], [20, 1, r2(before.allocated_m * 20), r2(before.allocated_m * 20)])
    await repo.updateOrder(oa, { order_no: before.order_no, date: before.date, customer_id: before.customer_id, quality_id: before.quality_id, notes: 'kept rate' })
    eq('an edit without the rate field keeps the rate', (await repo.getOrder(oa)).rate, 20)

    // payment log
    await expectThrow('payment amount must be > 0', () => repo.addOrderPayment(oa, { date: repo.today(), amount: 0 }))
    await expectThrow('payment needs a date', () => repo.addOrderPayment(oa, { date: '', amount: 10 }))
    await expectThrow('payment amount max 2 decimals', () => repo.addOrderPayment(oa, { date: repo.today(), amount: '1.234' }))
    const pay1 = await repo.addOrderPayment(oa, { date: repo.today(), amount: '100.50', mode: ' NEFT ', ref_no: 'UTR1' })
    await repo.addOrderPayment(oa, { date: repo.today(), amount: 50 })
    const withPays = await repo.getOrder(oa)
    eq('several payments per order, totals', [withPays.payments.length, withPays.payment.paid, withPays.payment.outstanding, withPays.payments.find((x) => x.id === pay1).mode], [2, 150.5, r2(withPays.payment.dispatched_amount - 150.5), 'NEFT'])
    await repo.removeOrderPayment(pay1)
    eq('a payment can be deleted', (await repo.getOrder(oa)).payment.paid, 50)
    eq('own reminder days for one order', [await repo.setOrderPaymentDays(oa, 30), (await repo.getOrder(oa)).payment.days, (await repo.getOrder(oa)).payment.own_days], [30, 30, true])
    await repo.setOrderPaymentDays(oa, null)
    eq('back to the default days', (await repo.getOrder(oa)).payment.days, 90)
    check('order list carries the payment state', (await repo.listOrders()).every((o) => o.payment && typeof o.payment.due === 'boolean'))
    check('dashboard counts payments due', typeof (await repo.dashboard()).paymentsDue.count === 'number')

    // reminder rule (pure): starts at the first dispatch, any payment restarts it, a fully paid order shows nothing
    const P = (pays, at, extra = {}) => repo.paymentInfo({ rate: 10, allocated_m: 100, paid: pays.reduce((a, x) => a + x.amount, 0), status: 'OPEN', ...extra }, [{ meters: 100 }], [{ d: '2026-01-01', m: 100 }], pays, 60, at)
    eq('no payment: not due on day 59', P([], '2026-03-01').due, false)
    eq('no payment: due on day 60', [P([], '2026-03-02').due, P([], '2026-03-02').due_on], [true, '2026-03-02'])
    eq('no payment: days late', P([], '2026-03-12').overdue_days, 10)
    const part = [{ d: '2026-02-01', amount: 400 }]
    eq('part payment restarts the counter from its date', [P(part, '2026-03-02').due, P(part, '2026-03-02').since, P(part, '2026-04-02').due], [false, '2026-02-01', true])
    eq('fully paid: never due', [P([{ d: '2026-01-10', amount: 1000 }], '2027-01-01').due, P([{ d: '2026-01-10', amount: 1000 }], '2027-01-01').since], [false, null])
    const again = repo.paymentInfo({ rate: 10, allocated_m: 150, paid: 1000, status: 'OPEN' }, [{ meters: 200 }], [{ d: '2026-01-01', m: 100 }, { d: '2026-05-01', m: 50 }], [{ d: '2026-01-10', amount: 1000 }], 60, '2026-06-01')
    eq('paid in full, then more dispatched: counts from the new dispatch', [again.since, again.outstanding, again.due, again.balance], ['2026-05-01', 500, false, 1000])
    eq('nothing dispatched: no reminder even when old', repo.paymentInfo({ rate: 10, allocated_m: 0, paid: 0, status: 'OPEN' }, [{ meters: 100 }], [], [], 60, '2030-01-01').due, false)
    eq('without a rate: counts from the last payment', repo.paymentInfo({ rate: null, allocated_m: 100, paid: 5, status: 'OPEN' }, [], [{ d: '2026-01-01', m: 100 }], [{ d: '2026-01-20', amount: 5 }], 60, '2026-03-05').due, false)
    eq('completed order expects what was dispatched', P([], '2026-01-02', { status: 'DONE', allocated_m: 80 }).expected_amount, 800)
    const advance = repo.paymentInfo({ rate: 10, allocated_m: 50, paid: 1000, status: 'OPEN' }, [{ meters: 100 }], [{ d: '2026-02-01', m: 50 }], [{ d: '2026-01-01', amount: 1000 }], 60, '2026-12-01')
    eq('advance payment covers later dispatches', [advance.outstanding, advance.due], [-500, false])

    // master details
    const dQ = await repo.getMasterDetail('qualities', q)
    const fin = await repo.inventoryList('finished', { quality_id: q }), gd = await repo.inventoryList('godown', { quality_id: q })
    eq('quality details: stock per stage matches Inventory', [dQ.stock.views.finished.takas, dQ.stock.views.finished.m, dQ.stock.views.godown.takas], [fin.length, r2(fin.reduce((a, t) => a + t.stock_m, 0)), gd.length])
    eq('quality details: orders received / ongoing / completed', [dQ.orderCounts.total, dQ.orderCounts.ongoing + dQ.orderCounts.completed], [(await repo.listOrders()).filter((o) => o.quality_id === q).length, dQ.orderCounts.total])
    check('quality details: POs and colours listed', dQ.pos.length >= 1 && dQ.colourCounts.total >= 4)
    const dF = await repo.getMasterDetail('weaver_groups', grp)
    eq('firm details: associated parties and POs', [dF.parties.length, dF.pos.every((x) => x.group_id === grp), dF.receipts.length > 0], [3, true, true])
    const dW = await repo.getMasterDetail('weavers', fFab)
    eq('associated party details: its challans only', [dW.row.group_name, dW.receipts.every((r) => r.weaver_id === fFab)], ['Ganesh', true])
    const dC = await repo.getMasterDetail('customers', cust)
    check('customer details: orders with payment totals', dC.orders.some((o) => o.id === oa) && dC.orderCounts.payment.paid >= 50)
    const dM = await repo.getMasterDetail('mills', m1)
    check('mill details: challans and programs', dM.challans.length > 0 && dM.programs.length > 0)
    const dB = await repo.getMasterDetail('branches', br)
    eq('branch details: grey here matches the godown view', dB.stock.views.godown.takas, (await repo.inventoryList('godown', { branch_id: br })).length)
    const dS = await repo.getMasterDetail('shades', sh['37'])
    check('shade details: qualities and orders', dS.qualities.some((x) => x.id === q) && dS.orders.some((o) => o.id === oa))
    const jwk = await M('job_workers', { name: 'Detail JW' })
    eq('job worker details with no challans', (await repo.getMasterDetail('job_workers', jwk)).counts.total, 0)
    eq('unknown master entry gives null', await repo.getMasterDetail('mills', 99999), null)
    await expectThrow('unknown master kind rejected', () => repo.getMasterDetail('nope', 1))
    await repo.setPaymentDays(60)
    await reconciled('at the end of client changes 5')
  }

  // --- the demo seed shows every new screen something (in-memory driver only: a reset is refused on a Turso-mode database)
  if (driver === 'sqljs') {
    const warns = []
    const origWarn = console.warn
    console.warn = (...a) => { warns.push(a.join(' ')) }
    await repo.resetDemo()
    console.warn = origWarn
    check('seed ran without warnings', warns.length === 0, warns.join(' | '))
    const jws = await repo.listJobWorks()
    eq('seed: JW-1 partly received, JW-2 completed, JW-3 closed short', jws.slice().sort((a, b) => a.jw_no - b.jw_no).map((c) => [c.jw_label, c.status]), [['JW-1', 'PARTIAL'], ['JW-2', 'COMPLETED'], ['JW-3', 'CLOSED']])
    eq('seed: JW-3 has 2 not-returned takas', jws.find((c) => c.jw_no === 3).lost_takas, 2)
    check('seed: JW-1 is linked to a job-work order', !!jws.find((c) => c.jw_no === 1).order_no)
    eq('seed: two job workers', (await repo.listJobWorkers()).length, 2)
    eq('seed: two grey sales, one with a rate', (await repo.listGreySales()).map((x) => x.amount != null).sort(), [false, true])
    const wdS = await repo.listWithdrawals()
    eq('seed: one FG withdrawal (active) and one cancelled grey withdrawal', wdS.map((w) => [w.kind, w.status]).sort(), [['FG_OTHER', 'ACTIVE'], ['GREY_OTHER', 'CANCELLED']])
    const progs = await repo.listPrograms()
    const mixed = progs.find((x) => x.notes && x.notes.startsWith('Mixed program'))
    check('seed: a new-style program with 2 qualities, 3 weaver challans and lots (PARTIAL)', !!mixed && mixed.nick_name.split(',').length === 2 && Number(mixed.challan_count) === 3 && mixed.status === 'PARTIAL' && mixed.lines.some((l) => l.lot_no === 'L-778') && mixed.lines.length === 4)
    check('seed: the earlier programs stay old-style', progs.filter((x) => Number(x.challan_count) === 0).length >= 3)
    eq('seed: second receipt reused the lot', (await repo.listFinishedReceipts('WHERE fr.challan_no=?', ['LDM-9215']))[0].lots.split(',').sort(), ['L-778', 'L-781'])
    check('seed: at least 2 closed orders', (await repo.sellHistory({ type: 'ORDER' })).rows.length >= 2)
    const ords = await repo.listOrders()
    const sN = ords.find((o) => o.order_no === 'SO-0006'), sJ = ords.find((o) => o.order_no === 'SO-0007')
    check('seed: an open normal order and an open job-work order exist', !!sN && !!sJ && sN.status === 'OPEN' && sJ.status === 'OPEN' && Number(sJ.job_work) === 1)
    check('seed: both have matching ready stock (Sell to order has data)', (await repo.previewOrderAllocation(sN.id)).lines.every((l) => l.gotT > 0) && (await repo.previewOrderAllocation(sJ.id)).lines.every((l) => l.gotT > 0))
    const inMillSeed = await repo.inMillPrograms()
    check('seed: In mill shows at least two programs in two mills, one with a lot already set', inMillSeed.length >= 2 && inMillSeed.flatMap((g) => g.programs).length >= 2 && inMillSeed.flatMap((g) => g.programs).some((x) => x.lots.length > 0))
    check('seed: the order detail stock works for every order', (await Promise.all(ords.map((o) => repo.orderAvailability(o.id)))).every((x) => x.lines.length > 0))
    await reconciled('after seeding')
  }
  // --- WhatsApp payment reminders: message templates master + filling a template from an order
  {
    const wa = await loadModule('/src/lib/whatsapp.js')
    // starter templates come from the migration, only while the table is empty
    await client.run('DELETE FROM message_templates')
    const starter = schema.MIGRATIONS.find((m) => m.sql.includes('INTO message_templates'))
    await client.run(starter.sql)
    eq('templates: two starter templates on an empty table', (await repo.listMessageTemplates()).map((t) => t.name), ['Detailed reminder', 'Polite reminder'])
    await client.run(starter.sql)
    eq('templates: the starter migration never adds them twice', (await repo.listMessageTemplates()).length, 2)

    const tid = await repo.saveMaster('message_templates', { name: '  Short  ', body: 'Hi {Customer name}, {amount due} pending on {Order no}. {Unknown}' })
    eq('templates: saved and trimmed', (await repo.listMessageTemplates()).find((t) => t.id === tid).name, 'Short')
    await expectThrow('templates: name must be unique (any case)', () => repo.saveMaster('message_templates', { name: 'short', body: 'x' }))
    await expectThrow('templates: message is required', () => repo.saveMaster('message_templates', { name: 'Empty', body: '   ' }))
    await repo.saveMaster('message_templates', { id: tid, name: 'Short', body: 'Changed {Order no}' })
    eq('templates: edited', (await repo.listMessageTemplates()).find((t) => t.id === tid).body, 'Changed {Order no}')
    await repo.removeMaster('message_templates', tid)
    check('templates: deleted', !(await repo.listMessageTemplates()).some((t) => t.id === tid))

    eq('fill: known fields any case, unknown left as typed',
      wa.fillTemplate('Hi {Customer name}, {amount due} pending on { Order no }. {Unknown}', { 'Customer name': 'Radhe', 'Amount due': '₹100', 'Order no': 'SO-1' }),
      'Hi Radhe, ₹100 pending on SO-1. {Unknown}')
    eq('phone: 10-digit mobile gets 91', wa.waPhone('98250 11223'), '919825011223')
    eq('phone: leading 0 dropped', wa.waPhone('098250-11223'), '919825011223')
    eq('phone: country code kept', wa.waPhone('+91 98250 11223'), '919825011223')
    eq('phone: junk is empty', wa.waPhone('12345'), '')
    eq('link: message url-encoded', wa.waLink('9825011223', 'Hi & bye\n₹5'), 'https://wa.me/919825011223?text=Hi%20%26%20bye%0A%E2%82%B95')

    // an order that owes money: the values the template is filled with
    const owing = (await repo.listOrders()).map((o) => o.id)
    const full = await Promise.all(owing.map((id) => repo.getOrder(id)))
    const o = full.find((x) => x.payment.outstanding > 0.005)
    check('order: some order has a payment pending', !!o)
    if (o) {
      check('order: carries the customer phone and contact', 'customer_phone' in o && 'customer_contact' in o)
      const v = wa.orderTemplateValues(o, '2026-10-30')
      eq('values: order no + customer', [v['Order no'], v['Customer name']], [o.order_no, o.customer_name])
      eq('values: amount due is the outstanding', v['Amount due'], format.fmtMoney(o.payment.outstanding))
      check('values: every field of the editor has a value', wa.TEMPLATE_FIELDS.every((f) => typeof v[f.key] === 'string'))
    }
  }
} catch (e) {
  fail++; console.log('FAIL  unexpected error:', e.stack || e)
}
console.log(`\n${pass} passed, ${fail} failed`)
await close()
process.exit(fail ? 1 : 0)
