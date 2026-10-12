// Realistic demo data. Uses repo functions so seed follows the same business logic as the UI.
import * as repo from './repo'
import { listTakas } from './repo'

let s = 42
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
const meter = (min = 94, max = 104) => Math.round((min + rnd() * (max - min)) * 100) / 100
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
const takas = (count, start = 1) => Array.from({ length: count }, (_, i) => ({ taka_no: start + i, meter: meter() }))

export async function seed() {
  s = 42
  const M = (t, o) => repo.saveMaster(t, o)

  // ---- masters
  const gGanesh = await M('weaver_groups', { name: 'Ganesh', contact: 'Rameshbhai Patel', phone: '98250 11223', city: 'Surat' })
  await M('weavers', { group_id: gGanesh, name: 'Ganesh Textiles', gstin: '24AAACG9999T1Z7', phone: '98250 11225' })
  const wGFab = await M('weavers', { group_id: gGanesh, name: 'Ganesh Fabrics', gstin: '24AAACG1234F1Z5', phone: '98250 11223' })
  const wGFas = await M('weavers', { group_id: gGanesh, name: 'Ganesh Fashion', gstin: '24AAACG5678K1Z2', phone: '98250 11224' })
  const gBalaji = await M('weaver_groups', { name: 'Shree Balaji Weaving', contact: 'Mahesh Agarwal', phone: '99090 45678', city: 'Bhiwandi' })
  const wBal = await M('weavers', { group_id: gBalaji, name: 'Balaji Silk Mills', gstin: '27AABCB9988L1Z9', phone: '99090 45678' })
  await M('weavers', { group_id: gBalaji, name: 'Balaji Synthetics', gstin: '27AABCB7766M1Z1', phone: '99090 45679' })
  const gKrishna = await M('weaver_groups', { name: 'Krishna Tex', contact: 'Jignesh Shah', phone: '97240 33445', city: 'Surat' })
  await M('weavers', { group_id: gKrishna, name: 'Krishna Fabrics', gstin: '24AAFCK4455Q1Z3', phone: '97240 33445' })

  const mLaxmi = await M('mills', { name: 'Laxmi Dyeing Mills', contact: 'Sureshbhai', phone: '93770 12121', city: 'Pandesara, Surat' })
  const mShiv = await M('mills', { name: 'Shiv Shakti Process House', contact: 'Vikram Jain', phone: '94260 34343', city: 'Sachin GIDC' })
  await M('mills', { name: 'Om Dyeing House', contact: 'Paresh Desai', phone: '98980 56565', city: 'Palsana' })

  const cRadhe = await M('customers', { name: 'Radhe Sarees', contact: 'Nilesh', phone: '98790 10101', city: 'Kolkata' })
  await M('customers', { name: 'Kalpana Fashion', contact: 'Kalpana Mehta', phone: '98111 20202', city: 'Delhi' })
  await M('customers', { name: 'Mahalaxmi Creation', contact: 'Sanjay', phone: '98222 30303', city: 'Mumbai' })

  const qGold = await M('qualities', { original_name: 'Nylon 60 GSM', nick_name: 'Gold Lava', taka_length: 100, notes: 'Shiny nylon base' })
  const qSilver = await M('qualities', { original_name: 'Poly Georgette', nick_name: 'Silver Wave', taka_length: 100 })
  const qRoyal = await M('qualities', { original_name: 'Rayon Slub', nick_name: 'Royal Slub', taka_length: 100 })
  await M('qualities', { original_name: 'Viscose Crepe', nick_name: 'Velvet Crepe', taka_length: 100 })

  const bSurat = await M('branches', { name: 'Surat Godown', city: 'Surat', address: 'Shop 6065, Textile Market' })
  const bBhiwandi = await M('branches', { name: 'Bhiwandi Branch', city: 'Bhiwandi', address: 'Shop 6070, Warehouse Row' })
  const L = {}
  for (const [branch, shop, rack] of [[bSurat, 'Shop 6065', 'Rack-A'], [bSurat, 'Shop 6065', 'Rack-B'], [bSurat, 'Shop 6065', 'Rack-C'], [bBhiwandi, 'Shop 6070', 'Rack-A'], [bBhiwandi, 'Shop 6070', 'Rack-B']]) {
    L[`${shop}/${rack}`] = await M('locations', { branch_id: branch, shop, rack })
  }

  const chA = await M('shade_charts', { name: 'Chart-A' })
  const chB = await M('shade_charts', { name: 'Chart-B' })
  const palette = [
    ['31', 'Ivory', '#F3EBDD'], ['32', 'Lemon', '#F4E04D'], ['33', 'Mango', '#F6A623'], ['34', 'Coral', '#F2705E'],
    ['35', 'Rani Pink', '#D6246E'], ['36', 'Wine', '#7B1E3A'], ['37', 'Royal Blue', '#2747B8'], ['38', 'Teal', '#138A8A'],
    ['39', 'Emerald', '#1E9E5A'], ['40', 'Mehndi', '#7D8B2E'], ['41', 'Rust', '#B5532A'], ['42', 'Navy', '#1E2A4F'],
    ['43', 'Lavender', '#A58BD6'], ['44', 'Grey', '#8A8F98'], ['45', 'Black', '#16161A'],
  ]
  const SH = {}
  for (const [number, name, hex] of palette) SH[number] = await M('shades', { chart_id: chA, number, name, hex })
  for (const [number, name, hex] of [['B1', 'Peach', '#F8B99B'], ['B2', 'Mint', '#9FE0C3'], ['B3', 'Sky', '#8EC5F2'], ['B4', 'Maroon', '#6A1B1B']]) {
    await M('shades', { chart_id: chB, number, name, hex })
  }

  // ---- item master: one unique code per quality + colour
  const IT = {}
  for (const [qid, qn] of [[qGold, 'Gold Lava'], [qSilver, 'Silver Wave'], [qRoyal, 'Royal Slub']]) {
    await repo.generateItems(qid, chA)
    for (const it of await repo.listItems()) if (it.nick_name === qn && it.chart_id === chA) IT[`${qn}/${it.shade_no}`] = it.id
  }

  // ---- grey POs
  const po1 = await repo.createPO({ po_no: 'PO-0001', po_date: daysAgo(40), group_id: gGanesh, quality_id: qGold, meters: 50000, rate: 3.5, taka_length: 100, due_date: daysAgo(-10), notes: 'Paper PO #GT/118' })
  const po2 = await repo.createPO({ po_no: 'PO-0002', po_date: daysAgo(30), group_id: gBalaji, quality_id: qSilver, meters: 20000, rate: 4.2, taka_length: 100, due_date: daysAgo(-5) })
  await repo.createPO({ po_no: 'PO-0003', po_date: daysAgo(6), group_id: gKrishna, quality_id: qRoyal, meters: 15000, rate: 5.1, taka_length: 100, due_date: daysAgo(-25) })
  const po4 = await repo.createPO({ po_no: 'PO-0004', po_date: daysAgo(60), group_id: gGanesh, quality_id: qSilver, meters: 3000, rate: 4.0, taka_length: 100 })

  // ---- grey receipts
  const r1Takas = takas(48)
  ;[94.69, 102.58, 103.5].forEach((m, i) => { r1Takas[i].meter = m })
  const r1 = await repo.createReceipt({ po_id: po1, weaver_id: wGFab, challan_no: 'GF-501', date: daysAgo(28), destination: 'GODOWN', branch_id: bSurat, takas: r1Takas })
  await repo.createReceipt({ po_id: po1, weaver_id: wGFas, challan_no: 'GFS-77', date: daysAgo(24), destination: 'MILL', mill_id: mLaxmi, takas: takas(36) })
  const r3 = await repo.createReceipt({ po_id: po2, weaver_id: wBal, challan_no: 'BSM-2231', date: daysAgo(18), destination: 'GODOWN', branch_id: bBhiwandi, takas: takas(30) })
  await repo.createReceipt({ po_id: po1, weaver_id: wGFab, challan_no: 'GF-519', date: daysAgo(3), destination: 'GODOWN', branch_id: bSurat, takas: takas(24, 49) })
  await repo.createReceipt({ po_id: po4, weaver_id: wGFas, challan_no: 'GFS-61', date: daysAgo(50), destination: 'GODOWN', branch_id: bBhiwandi, takas: takas(29) })
  await repo.setPOClosed(po4, true)

  // ---- rack assignment
  const r1t = await listTakas('WHERE t.receipt_id=?', [r1])
  await repo.assignLocation(r1t.slice(0, 24).map((t) => t.id), L['Shop 6065/Rack-A'])
  await repo.assignLocation(r1t.slice(24).map((t) => t.id), L['Shop 6065/Rack-B'])
  const r3t = await listTakas('WHERE t.receipt_id=?', [r3])
  await repo.assignLocation(r3t.slice(0, 20).map((t) => t.id), L['Shop 6070/Rack-A'])

  // ---- dispatch 36 of 48 from GF-501 to Laxmi
  await repo.createDispatch({ mill_id: mLaxmi, date: daysAgo(20), taka_ids: r1t.slice(0, 36).map((t) => t.id), notes: 'Urgent for Radhe order' })
  await repo.createDispatch({ mill_id: mShiv, date: daysAgo(12), taka_ids: r3t.slice(0, 12).map((t) => t.id) })

  // ---- dyeing programs
  const pg1 = await repo.createProgram({ mill_id: mLaxmi, quality_id: qGold, chart_id: chA, date: daysAgo(19), lines: [{ item_id: IT['Gold Lava/37'], taka_count: 24 }, { item_id: IT['Gold Lava/39'], taka_count: 24 }] })
  await repo.createProgram({ mill_id: mLaxmi, quality_id: qGold, chart_id: chA, date: daysAgo(9), lines: [{ item_id: IT['Gold Lava/38'], taka_count: 14 }, { item_id: IT['Gold Lava/35'], taka_count: 6 }] })
  await repo.createProgram({ mill_id: mShiv, quality_id: qSilver, chart_id: chA, date: daysAgo(10), lines: [{ item_id: IT['Silver Wave/42'], taka_count: 12 }] })

  // ---- finished receipt: shade 37 fully + 10 of shade 39
  const p1 = await repo.getProgram(pg1)
  const l37 = p1.lines.find((l) => l.shade_id === SH['37'])
  const l39 = p1.lines.find((l) => l.shade_id === SH['39'])
  const recv = [...p1.takas.filter((t) => t.program_line_id === l37.id), ...p1.takas.filter((t) => t.program_line_id === l39.id).slice(0, 10)]
  await repo.createFinishedReceipt({
    program_id: pg1, challan_no: 'LDM-9041', date: daysAgo(8),
    rows: recv.map((t) => ({ id: t.id, mill_grey_meter: t.grey_meter, finished_meter: Math.round(t.grey_meter * (0.9 + rnd() * 0.04) * 100) / 100 })),
  })

  // ---- folding: 20 takas
  const fin = await listTakas(`WHERE t.status='FINISHED'`)
  await repo.foldTakas(fin.slice(0, 20).map((t) => ({ id: t.id, folded_meter: Math.round((t.finished_meter - rnd() * 1.6) * 100) / 100 })), daysAgo(5))

  // ---- customer order
  const o1 = await repo.createOrder({ order_no: 'SO-0001', date: daysAgo(4), customer_id: cRadhe, quality_id: qGold, notes: 'Lump order 500 taka — first lot', lines: [{ item_id: IT['Gold Lava/37'], taka_count: 10 }, { item_id: IT['Gold Lava/38'], taka_count: 50 }, { item_id: IT['Gold Lava/39'], taka_count: 50 }] })
  await repo.allocateOrder(o1)
  await repo.createOrder({ order_no: 'SO-0002', date: daysAgo(1), customer_id: cRadhe, quality_id: qGold, notes: 'Customer asked in meters', lines: [{ item_id: IT['Gold Lava/37'], meters: 1500 }] })
}
