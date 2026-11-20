// Realistic demo data. Uses repo functions so seed follows the same business logic as the UI.
import * as repo from './repo'
import { listTakas } from './repo'

let s = 42
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
const meter = (min = 94, max = 104) => Math.round((min + rnd() * (max - min)) * 100) / 100
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
const takas = (count, start = 1) => Array.from({ length: count }, (_, i) => ({ taka_no: start + i, meter: meter() }))

/** A small striped / dotted picture as a data URL — stands in for a photographed shade that no colour picker can make. */
const svgImage = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
const BANDHANI = svgImage(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="#b3123c"/>${Array.from({ length: 6 }, (_, r) => Array.from({ length: 8 }, (_, c) => `<circle cx="${20 + c * 30 + (r % 2) * 15}" cy="${18 + r * 29}" r="5" fill="#f8e7c4"/>`).join('')).join('')}</svg>`)
const GOLD_STRIPE = svgImage(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="#e9c25a"/>${Array.from({ length: 10 }, (_, i) => `<rect x="${i * 24 + 6}" y="0" width="8" height="180" fill="#9c7a1e"/>`).join('')}</svg>`)
const DAMAGE_PHOTO = svgImage(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="#2747B8"/><path d="M20 120 L90 60 L130 110 L200 40" stroke="#f4f4f4" stroke-width="6" fill="none"/></svg>`)

export async function seed() {
  s = 42
  const M = (t, o) => repo.saveMaster(t, o)

  // ---- masters
  const gGanesh = await M('weaver_groups', { name: 'Ganesh', contact: 'Rameshbhai Patel', phone: '98250 11223', city: 'Surat', gstin: '24AAACG1111G1Z3' })
  const wGTex = await M('weavers', { group_id: gGanesh, name: 'Ganesh Textiles', gstin: '24AAACG9999T1Z7', phone: '98250 11225' })
  const wGFab = await M('weavers', { group_id: gGanesh, name: 'Ganesh Fabrics', gstin: '24AAACG1234F1Z5', phone: '98250 11223' })
  const wGFas = await M('weavers', { group_id: gGanesh, name: 'Ganesh Fashion', gstin: '24AAACG5678K1Z2', phone: '98250 11224' })
  const gBalaji = await M('weaver_groups', { name: 'Shree Balaji Weaving', contact: 'Mahesh Agarwal', phone: '99090 45678', city: 'Bhiwandi' })
  const wBal = await M('weavers', { group_id: gBalaji, name: 'Balaji Silk Mills', gstin: '27AABCB9988L1Z9', phone: '99090 45678' })
  await M('weavers', { group_id: gBalaji, name: 'Balaji Synthetics', gstin: '27AABCB7766M1Z1', phone: '99090 45679' })
  const gKrishna = await M('weaver_groups', { name: 'Krishna Tex', contact: 'Jignesh Shah', phone: '97240 33445', city: 'Surat' })
  await M('weavers', { group_id: gKrishna, name: 'Krishna Fabrics', gstin: '24AAFCK4455Q1Z3', phone: '97240 33445' })

  const mLaxmi = await M('mills', { name: 'Laxmi Dyeing Mills', contact: 'Sureshbhai', phone: '93770 12121', city: 'Pandesara, Surat', gstin: '24AAACL1234F1Z5' })
  const mShiv = await M('mills', { name: 'Shiv Shakti Process House', contact: 'Vikram Jain', phone: '94260 34343', city: 'Sachin GIDC', gstin: '24AABCS5678K1Z2' })
  await M('mills', { name: 'Om Dyeing House', contact: 'Paresh Desai', phone: '98980 56565', city: 'Palsana', gstin: '24AAACO9999T1Z7' })

  const cRadhe = await M('customers', { name: 'Radhe Sarees', contact: 'Nilesh', phone: '98790 10101', city: 'Kolkata', gstin: '19AAACR1234F1Z5' })
  await M('customers', { name: 'Kalpana Fashion', contact: 'Kalpana Mehta', phone: '98111 20202', city: 'Delhi', gstin: '07AABCK9988L1Z9' })
  await M('customers', { name: 'Mahalaxmi Creation', contact: 'Sanjay', phone: '98222 30303', city: 'Mumbai' })

  const qGold = await M('qualities', { original_name: 'Nylon 60 GSM', nick_name: 'Gold Lava', taka_length: 100, notes: 'Shiny nylon base' })
  const qSilver = await M('qualities', { original_name: 'Poly Georgette', nick_name: 'Silver Wave', taka_length: 100 })
  const qRoyal = await M('qualities', { original_name: 'Rayon Slub', nick_name: 'Royal Slub', taka_length: 100 })
  const qVelvet = await M('qualities', { original_name: 'Viscose Crepe', nick_name: 'Velvet Crepe', taka_length: 100 })

  // branches only: grey is received at a branch, there are no racks any more
  const bSurat = await M('branches', { name: 'Surat Godown', city: 'Surat', address: 'Shop 6065, Textile Market' })
  const bBhiwandi = await M('branches', { name: 'Bhiwandi Branch', city: 'Bhiwandi', address: 'Shop 6070, Warehouse Row' })

  // ---- the common colour library (6 plain colours + 2 that are a photo) …
  const SH = {}
  for (const [number, name, hex] of [
    ['Mango', 'Warm orange-yellow', '#F6A623'], ['Rani Pink', 'Deep magenta pink', '#D6246E'], ['Wine', 'Dark red wine', '#7B1E3A'],
    ['Royal Blue', 'Rich blue', '#2747B8'], ['Teal', 'Blue-green', '#138A8A'], ['Emerald', 'Bright green', '#1E9E5A'],
  ]) SH[number] = await M('shades', { number, name, hex })
  SH['Bandhani Print'] = await M('shades', { number: 'Bandhani Print', name: 'Dotted tie-dye look (photo)', hex: '#b3123c', image_url: BANDHANI })
  SH['Gold Stripe'] = await M('shades', { number: 'Gold Stripe', name: 'Gold with dark stripes (photo)', image_url: GOLD_STRIPE })

  // … and which colours each quality can use
  await repo.addQualityColours(qGold, ['Mango', 'Rani Pink', 'Wine', 'Royal Blue', 'Teal', 'Emerald', 'Gold Stripe'].map((n) => SH[n]))
  await repo.addQualityColours(qSilver, ['Royal Blue', 'Teal', 'Bandhani Print'].map((n) => SH[n]))
  await repo.addQualityColours(qRoyal, ['Rani Pink', 'Emerald'].map((n) => SH[n]))
  await repo.addOwnColour(qGold, { number: 'Lava Gold', name: 'Only for Gold Lava', hex: '#C9A227' }) // private: not in the library
  await repo.setQualityColourActive(qGold, SH['Wine'], false) // an inactive colour (never used)

  // ---- grey POs (several stay open so the order screen shows pending numbers)
  const po1 = await repo.createPO({ po_no: 'PO-0001', po_date: daysAgo(40), group_id: gGanesh, quality_id: qGold, meters: 50000, rate: 3.5, taka_length: 100, due_date: daysAgo(-10), notes: 'Paper PO #GT/118' })
  const po2 = await repo.createPO({ po_no: 'PO-0002', po_date: daysAgo(30), group_id: gBalaji, quality_id: qSilver, meters: 20000, rate: 4.2, taka_length: 100, due_date: daysAgo(-5) })
  await repo.createPO({ po_no: 'PO-0003', po_date: daysAgo(6), group_id: gKrishna, quality_id: qRoyal, meters: 15000, rate: 5.1, taka_length: 100, due_date: daysAgo(-25) })
  const po4 = await repo.createPO({ po_no: 'PO-0004', po_date: daysAgo(60), group_id: gGanesh, quality_id: qSilver, meters: 3000, rate: 4.0, taka_length: 100 })
  await repo.createPO({ po_no: 'PO-0005', po_date: daysAgo(3), group_id: gBalaji, quality_id: qVelvet, meters: 8000, rate: 4.8, taka_length: 100 })

  // ---- grey (weaver) challans
  const r1Takas = takas(48)
  ;[94.69, 102.58, 103.5].forEach((m, i) => { r1Takas[i].meter = m })
  const r1 = await repo.createReceipt({ po_id: po1, weaver_id: wGFab, challan_no: 'GF-501', date: daysAgo(28), destination: 'GODOWN', branch_id: bSurat, takas: r1Takas })
  await repo.createReceipt({ po_id: po1, weaver_id: wGFas, challan_no: 'GFS-77', date: daysAgo(24), destination: 'MILL', mill_id: mLaxmi, takas: takas(36) }) // direct to the mill
  const r3 = await repo.createReceipt({ po_id: po2, weaver_id: wBal, challan_no: 'BSM-2231', date: daysAgo(18), destination: 'GODOWN', branch_id: bBhiwandi, takas: takas(30) })
  await repo.createReceipt({ po_id: po1, weaver_id: wGFab, challan_no: 'GF-519', date: daysAgo(3), destination: 'GODOWN', branch_id: bSurat, takas: takas(24, 49) })
  await repo.createReceipt({ po_id: po4, weaver_id: wGFas, challan_no: 'GFS-61', date: daysAgo(50), destination: 'GODOWN', branch_id: bBhiwandi, takas: takas(29) })
  const r6 = await repo.createReceipt({ po_id: po1, weaver_id: wGFas, challan_no: 'GFS-90', date: daysAgo(26), destination: 'GODOWN', branch_id: bSurat, takas: takas(30, 101) })
  const r7 = await repo.createReceipt({ po_id: po1, weaver_id: wGTex, challan_no: 'GT-44', date: daysAgo(25), destination: 'GODOWN', branch_id: bBhiwandi, takas: takas(20, 201) })
  await repo.setPOClosed(po4, true)

  // ---- mill challans: one main challan with three sub-challans (1A, 1B, 1C), one with a single sub-challan
  const ids = async (receiptId) => (await listTakas("WHERE t.receipt_id=? AND t.status='GODOWN_GREY'", [receiptId])).map((t) => t.id)
  const main1 = await repo.createMillChallan({
    mill_id: mLaxmi, date: daysAgo(20), notes: 'Urgent for Radhe order',
    parts: [{ receipt_id: r1, taka_ids: (await ids(r1)).slice(0, 36) }, { receipt_id: r6, taka_ids: await ids(r6) }, { receipt_id: r7, taka_ids: await ids(r7) }],
  })
  await repo.closeMillChallan(main1)
  await repo.createMillChallan({ mill_id: mShiv, date: daysAgo(12), parts: [{ receipt_id: r3, taka_ids: (await ids(r3)).slice(0, 12) }] })

  // ---- dyeing programs (colours of the quality)
  const pg1 = await repo.createProgram({ mill_id: mLaxmi, quality_id: qGold, date: daysAgo(19), lines: [{ shade_id: SH['Royal Blue'], taka_count: 30 }, { shade_id: SH['Emerald'], taka_count: 30 }, { shade_id: SH['Mango'], taka_count: 20 }] })
  const pg2 = await repo.createProgram({ mill_id: mLaxmi, quality_id: qGold, date: daysAgo(9), lines: [{ shade_id: SH['Teal'], taka_count: 14 }, { shade_id: SH['Rani Pink'], taka_count: 6 }] })
  const pg3 = await repo.createProgram({ mill_id: mShiv, quality_id: qSilver, date: daysAgo(10), lines: [{ shade_id: SH['Royal Blue'], taka_count: 8 }, { shade_id: SH['Bandhani Print'], taka_count: 4 }] })

  // ---- mill return challans (partial): the finished meter is entered, the grey meter comes from the weaver challan
  const finish = (t) => ({ id: t.id, finished_meter: Math.round(t.grey_meter * (0.9 + rnd() * 0.04) * 100) / 100 })
  const p1 = await repo.getProgram(pg1)
  const lineOf = (p, shadeId) => p.lines.find((l) => l.shade_id === shadeId)
  const blue = p1.takas.filter((t) => t.program_line_id === lineOf(p1, SH['Royal Blue']).id)
  const emerald = p1.takas.filter((t) => t.program_line_id === lineOf(p1, SH['Emerald']).id)
  await repo.createFinishedReceipt({ program_id: pg1, challan_no: 'LDM-9041', date: daysAgo(8), rows: [...blue, ...emerald.slice(0, 10)].map(finish) })
  const p2 = await repo.getProgram(pg2)
  await repo.createFinishedReceipt({ program_id: pg2, challan_no: 'LDM-9102', date: daysAgo(3), rows: p2.takas.filter((t) => t.program_line_id === lineOf(p2, SH['Teal']).id).slice(0, 10).map(finish) })
  const p3 = await repo.getProgram(pg3)
  await repo.createFinishedReceipt({ program_id: pg3, challan_no: 'SSP-310', date: daysAgo(2), rows: p3.takas.filter((t) => t.program_line_id === lineOf(p3, SH['Royal Blue']).id).map(finish) })

  // ---- folding: 22 takas of Gold Lava, two of them damaged (one with a note, one with a photo)
  const fin = (await listTakas(`WHERE t.status='FINISHED' AND p.quality_id=?`, [qGold])).slice(0, 22)
  await repo.foldTakas(fin.map((t, i) => ({
    id: t.id,
    folded_meter: Math.round((t.finished_meter - rnd() * 1.6) * 100) / 100,
    damage: i === 3 ? { meters: 4.5, notes: 'Torn near the selvedge' } : i === 11 ? { meters: 2.25, image_url: DAMAGE_PHOTO } : undefined,
  })), daysAgo(5))

  // ---- customer orders
  const o1 = await repo.createOrder({ order_no: 'SO-0001', rate: 42.5, date: daysAgo(4), customer_id: cRadhe, quality_id: qGold, notes: 'Lump order — first lot', lines: [{ shade_id: SH['Royal Blue'], taka_count: 10 }, { shade_id: SH['Teal'], taka_count: 20 }, { shade_id: SH['Emerald'], taka_count: 20 }] })
  await repo.allocateOrder(o1)
  // a part payment against the first order (Order details → Payment)
  await repo.addOrderPayment(o1, { date: repo.today(), amount: 5000, mode: 'NEFT', ref_no: 'UTR 4471' })
  await repo.createOrder({ order_no: 'SO-0002', rate: 44, date: daysAgo(1), customer_id: cRadhe, quality_id: qGold, notes: 'Customer asked in meters', lines: [{ shade_id: SH['Royal Blue'], meters: 1500 }] })

  await seedClientChanges2({ SH, qGold, cRadhe, wGFab, wGFas, bSurat })
  await seedClientChanges3({ SH, mLaxmi, r3, po1, po2, wGFab, wBal })
  await seedClientChanges4({ SH, qGold, cRadhe })
}

/** Job work, withdrawals, grey sales and closed orders — guarded so a short stock never breaks the demo start-up. */
async function seedClientChanges2({ SH, qGold, wGFab, wGFas }) {
  try {
    const M = (t, o) => repo.saveMaster(t, o)
    // fold the rest of the Gold Lava that came back from the mill, so there is plain stock to send out
    const rest = await listTakas(`WHERE t.status='FINISHED' AND p.quality_id=?`, [qGold])
    if (rest.length) await repo.foldTakas(rest.map((t) => ({ id: t.id, folded_meter: Math.round((t.finished_meter - rnd() * 1.2) * 100) / 100 })), daysAgo(4))

    const jwA = await M('job_workers', { name: 'Shree Embroidery Works', phone: '98250 77001', city: 'Surat', gstin: '24AAACS4321E1Z8', notes: 'Hand and machine embroidery' })
    const jwB = await M('job_workers', { name: 'Print House', phone: '98250 77002', city: 'Surat' })
    const stock = async () => repo.listFgStock()
    const plain = async (shade) => (await stock()).find((r) => r.quality_id === qGold && r.shade_id === shade)?.plain_takas || 0
    const kalpana = (await repo.listCustomers()).find((c) => c.name === 'Kalpana Fashion')

    // an order that needs embroidery on Royal Blue
    const oJob = await repo.createOrder({ order_no: 'SO-0003', rate: 58, date: daysAgo(3), customer_id: kalpana.id, quality_id: qGold, job_work: true, job_type: 'Embroidery', job_notes: 'Border embroidery', lines: [{ shade_id: SH['Royal Blue'], taka_count: 4 }] })

    // JW-1: Embroidery, partly received, linked to the job-work order
    const jw1 = await repo.createJobWork({ job_worker_id: jwA, job_type: 'Embroidery', date: daysAgo(3), order_id: oJob, notes: 'Border work',
      lines: [{ quality_id: qGold, shade_id: SH['Royal Blue'], takas: Math.min(6, await plain(SH['Royal Blue'])) }, { quality_id: qGold, shade_id: SH['Emerald'], takas: Math.min(3, await plain(SH['Emerald'])) }] })
    const j1 = await repo.getJobWork(jw1)
    await repo.receiveJobWork(jw1, { date: daysAgo(1), ref_no: 'SEW-118', notes: 'First lot back', rows: j1.takas.slice(0, 4).map((t, i) => ({ taka_id: t.taka_id, received_m: Math.round((t.sent_m - 0.5 - i * 0.25) * 100) / 100 })) })

    // JW-2: Printing, completed
    const jw2 = await repo.createJobWork({ job_worker_id: jwB, job_type: 'Printing', date: daysAgo(6), lines: [{ quality_id: qGold, shade_id: SH['Teal'], takas: Math.min(4, await plain(SH['Teal'])) }] })
    const j2 = await repo.getJobWork(jw2)
    await repo.receiveJobWork(jw2, { date: daysAgo(2), ref_no: 'PH-45', rows: j2.takas.map((t) => ({ taka_id: t.taka_id, received_m: Math.round((t.sent_m - 0.4) * 100) / 100 })) })

    // JW-3: closed short — two takas never came back
    const jw3 = await repo.createJobWork({ job_worker_id: jwA, job_type: 'Embroidery', date: daysAgo(9), lines: [{ quality_id: qGold, shade_id: SH['Emerald'], takas: Math.min(4, await plain(SH['Emerald'])) }] })
    const j3 = await repo.getJobWork(jw3)
    if (j3.takas.length > 2) await repo.receiveJobWork(jw3, { date: daysAgo(5), rows: j3.takas.slice(0, j3.takas.length - 2).map((t) => ({ taka_id: t.taka_id, received_m: t.sent_m })) })
    await repo.closeJobWork(jw3, 'Two takas lost at the job worker')

    // closed orders (plain stock) and one finished-goods withdrawal
    const oA = await repo.createOrder({ order_no: 'SO-0004', rate: 42.5, date: daysAgo(2), customer_id: kalpana.id, quality_id: qGold, lines: [{ shade_id: SH['Mango'], taka_count: 1 }, { shade_id: SH['Teal'], taka_count: Math.min(2, await plain(SH['Teal'])) || 1 }] })
    await repo.allocateOrder(oA)
    const oB = await repo.createOrder({ order_no: 'SO-0005', rate: 43, date: daysAgo(1), customer_id: kalpana.id, quality_id: qGold, lines: [{ shade_id: SH['Royal Blue'], taka_count: 2 }] })
    await repo.allocateOrder(oB)
    await repo.closeOrder(oA)
    await repo.createFgWithdrawal({ reason: 'Sample for a buyer', date: daysAgo(1), lines: [{ quality_id: qGold, shade_id: SH['Royal Blue'], takas: Math.min(2, await plain(SH['Royal Blue'])) || 1 }] })

    // grey: two direct sales (one with a rate) and a cancelled "Others" withdrawal
    const godown = async (weaver) => (await repo.greyGodownTakas({ weaver_id: weaver }))
    const mahalaxmi = (await repo.listCustomers()).find((c) => c.name === 'Mahalaxmi Creation')
    const t1 = (await godown(wGFab)).slice(0, 5)
    await repo.createGreySale({ weaver_id: wGFab, customer_id: mahalaxmi.id, taka_ids: t1.map((t) => t.id), rate: 28.5, date: daysAgo(2), notes: 'Cash sale' })
    const t2 = (await godown(wGFas)).slice(0, 6)
    await repo.createGreySale({ weaver_id: wGFas, customer_id: kalpana.id, taka_ids: t2.map((t) => t.id), date: daysAgo(1) })
    const t3 = (await godown(wGFab)).slice(0, 3)
    const wd = await repo.createGreyWithdrawal({ reason: 'Returned to weaver (changed our mind)', date: daysAgo(1), taka_ids: t3.map((t) => t.id) })
    await repo.cancelWithdrawal(wd)
  } catch (e) {
    console.warn('Demo data for job work / withdrawals was only partly created:', e?.message)
  }
}

/** A program against weaver challans (2 qualities, 3 challans — one direct to the mill, 2 colours in one challan) with lot-wise receipts. The earlier programs stay old-style. */
async function seedClientChanges3({ SH, mLaxmi, r3, po1, po2, wGFab, wBal }) {
  try {
    const gf519 = (await repo.listGodownChallans()).find((c) => c.challan_no === 'GF-519')
    const godown = async (rid) => (await listTakas("WHERE t.receipt_id=? AND t.status='GODOWN_GREY'", [rid])).map((t) => t.id)
    await repo.createMillChallan({ mill_id: mLaxmi, date: daysAgo(4), notes: 'Second trip', parts: [
      { receipt_id: r3, taka_ids: (await godown(r3)).slice(0, 18) }, { receipt_id: gf519.id, taka_ids: (await godown(gf519.id)).slice(0, 10) },
    ] })
    const at = (await repo.millChallansForProgram(mLaxmi)).flatMap((w) => w.challans)
    const ch = (no) => at.find((c) => c.challan_no === no)
    const ids = async (c) => (await repo.programTakasOfReceipt(mLaxmi, c.id)).map((t) => t.id)
    const direct = ch('GFS-77'), via = ch('GF-519'), silver = ch('BSM-2231')
    const dIds = await ids(direct)
    const pg = await repo.createProgram({ mill_id: mLaxmi, date: daysAgo(3), notes: 'Mixed program — two qualities', parts: [
      { receipt_id: direct.id, lines: [{ shade_id: SH['Mango'], taka_ids: dIds.slice(0, 12) }, { shade_id: SH['Teal'], taka_ids: dIds.slice(12) }] },
      { receipt_id: via.id, lines: [{ shade_id: SH['Rani Pink'], taka_ids: await ids(via) }] },
      { receipt_id: silver.id, lines: [{ shade_id: SH['Bandhani Print'], taka_ids: await ids(silver) }] },
    ] })
    const P = await repo.getProgram(pg)
    const line = (shade) => P.lines.find((l) => l.shade_id === shade)
    const fin = (t) => ({ id: t.id, finished_meter: Math.round(t.grey_meter * (0.91 + rnd() * 0.03) * 100) / 100 })
    const of = (l, n, from = 0) => P.takas.filter((t) => t.program_line_id === l.id).slice(from, n).map(fin)
    await repo.createFinishedReceipt({ program_id: pg, challan_no: 'LDM-9210', date: daysAgo(2), lines: [
      { program_line_id: line(SH['Mango']).id, lot_no: 'L-778', rows: of(line(SH['Mango']), 8) },
      { program_line_id: line(SH['Teal']).id, lot_no: 'L-779', rows: of(line(SH['Teal']), 99) },
      { program_line_id: line(SH['Rani Pink']).id, lot_no: 'L-780', rows: of(line(SH['Rani Pink']), 5) },
    ] })
    await repo.createFinishedReceipt({ program_id: pg, challan_no: 'LDM-9215', date: daysAgo(1), lines: [
      { program_line_id: line(SH['Mango']).id, lot_no: 'L-778', rows: of(line(SH['Mango']), 99, 8) }, // same line, same (locked) lot
      { program_line_id: line(SH['Bandhani Print']).id, lot_no: 'L-781', rows: of(line(SH['Bandhani Print']), 10) },
    ] })
    // fresh grey that arrived straight at the mill and is not in any program yet (so "Issue program" and "Add more takas" have something to pick)
    await repo.createReceipt({ po_id: po1, weaver_id: wGFab, challan_no: 'GF-540', date: daysAgo(1), destination: 'MILL', mill_id: mLaxmi, takas: takas(14, 301) })
    await repo.createReceipt({ po_id: po2, weaver_id: wBal, challan_no: 'BSM-2299', date: daysAgo(1), destination: 'MILL', mill_id: mLaxmi, takas: takas(8, 301) })
  } catch (e) {
    console.warn('Demo data for the program against weaver challans was only partly created:', e?.message)
  }
}

/**
 * Round 4: an open normal order and an open job-work order that both have matching ready stock (so "Sell to order" and the stock on the order
 * detail have data). "In mill" is fed by the programs above: two mills, partly received programs, one with lots already set (L-778 …).
 */
async function seedClientChanges4({ SH, qGold, cRadhe }) {
  try {
    const stock = await repo.listFgStock()
    const plain = (shade) => stock.find((r) => r.quality_id === qGold && r.shade_id === shade)?.plain_takas || 0
    await repo.createOrder({ order_no: 'SO-0006', rate: 45, date: daysAgo(1), customer_id: cRadhe, quality_id: qGold, notes: 'Open order with ready stock — try Inventory → Withdraw → Sell to order',
      lines: [{ shade_id: SH['Teal'], taka_count: Math.max(1, Math.min(3, plain(SH['Teal']))) }, { shade_id: SH['Emerald'], taka_count: Math.max(1, Math.min(4, plain(SH['Emerald']))) }] })
    await repo.createOrder({ order_no: 'SO-0007', rate: 60, date: daysAgo(1), customer_id: cRadhe, quality_id: qGold, job_work: true, job_type: 'Embroidery', job_notes: 'Needs the embroidered Royal Blue',
      lines: [{ shade_id: SH['Royal Blue'], taka_count: 2 }] })
  } catch (e) {
    console.warn('Demo data for sell-to-order was only partly created:', e?.message)
  }
}
