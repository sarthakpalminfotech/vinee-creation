// Single SQL schema used by both Turso (remote libSQL) and local sql.js.
// Bump SCHEMA_VERSION whenever SCHEMA / COLUMNS / MIGRATIONS change: start-up skips all of it when the stored version matches.
export const SCHEMA_VERSION = 7

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS weaver_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT, phone TEXT, city TEXT)`,
  `CREATE TABLE IF NOT EXISTS weavers (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, name TEXT NOT NULL, gstin TEXT, phone TEXT)`,
  `CREATE TABLE IF NOT EXISTS mills (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT, phone TEXT, city TEXT)`,
  `CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT, phone TEXT, city TEXT)`,
  `CREATE TABLE IF NOT EXISTS qualities (id INTEGER PRIMARY KEY AUTOINCREMENT, original_name TEXT NOT NULL, nick_name TEXT NOT NULL, taka_length REAL DEFAULT 100, notes TEXT)`,
  `CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT, shop TEXT NOT NULL, rack TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS shade_charts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS shades (id INTEGER PRIMARY KEY AUTOINCREMENT, chart_id INTEGER NOT NULL, number TEXT NOT NULL, name TEXT, hex TEXT DEFAULT '#cccccc')`,

  `CREATE TABLE IF NOT EXISTS grey_pos (id INTEGER PRIMARY KEY AUTOINCREMENT, po_no TEXT NOT NULL, po_date TEXT, group_id INTEGER NOT NULL, quality_id INTEGER NOT NULL, meters REAL NOT NULL, rate REAL NOT NULL, taka_length REAL DEFAULT 100, due_date TEXT, notes TEXT, image_url TEXT, closed INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS grey_receipts (id INTEGER PRIMARY KEY AUTOINCREMENT, po_id INTEGER NOT NULL, weaver_id INTEGER NOT NULL, challan_no TEXT NOT NULL, date TEXT, destination TEXT NOT NULL DEFAULT 'GODOWN', mill_id INTEGER, image_url TEXT, notes TEXT)`,
  `CREATE TABLE IF NOT EXISTS takas (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_id INTEGER NOT NULL, taka_no TEXT NOT NULL, grey_meter REAL NOT NULL, status TEXT NOT NULL, location_id INTEGER, mill_id INTEGER, dispatch_id INTEGER, program_line_id INTEGER, finished_receipt_id INTEGER, mill_grey_meter REAL, finished_meter REAL, folded_meter REAL, folded_on TEXT, order_id INTEGER)`,
  `CREATE TABLE IF NOT EXISTS mill_dispatches (id INTEGER PRIMARY KEY AUTOINCREMENT, dispatch_no TEXT NOT NULL, date TEXT, mill_id INTEGER NOT NULL, notes TEXT)`,
  `CREATE TABLE IF NOT EXISTS programs (id INTEGER PRIMARY KEY AUTOINCREMENT, program_no TEXT NOT NULL, date TEXT, mill_id INTEGER NOT NULL, quality_id INTEGER NOT NULL, chart_id INTEGER NOT NULL, notes TEXT)`,
  `CREATE TABLE IF NOT EXISTS program_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER NOT NULL, shade_id INTEGER NOT NULL, taka_count INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS finished_receipts (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER NOT NULL, challan_no TEXT NOT NULL, date TEXT, image_url TEXT, notes TEXT)`,
  `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL, date TEXT, customer_id INTEGER NOT NULL, quality_id INTEGER NOT NULL, notes TEXT, status TEXT DEFAULT 'OPEN')`,
  `CREATE TABLE IF NOT EXISTS order_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, shade_id INTEGER NOT NULL, taka_count INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_takas_status ON takas(status)`,
  `CREATE INDEX IF NOT EXISTS idx_takas_receipt ON takas(receipt_id)`,
  // --- audit additions (additive only; see docs/MIGRATIONS.md) ---
  `CREATE TABLE IF NOT EXISTS taka_moves (id INTEGER PRIMARY KEY AUTOINCREMENT, taka_id INTEGER NOT NULL, at TEXT NOT NULL, from_status TEXT, to_status TEXT NOT NULL, from_location_id INTEGER, to_location_id INTEGER, mill_id INTEGER, ref_type TEXT, ref_id INTEGER, note TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_moves_taka ON taka_moves(taka_id)`,
  `CREATE INDEX IF NOT EXISTS idx_moves_ref ON taka_moves(ref_type, ref_id)`,
  `CREATE INDEX IF NOT EXISTS idx_takas_dispatch ON takas(dispatch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_takas_line ON takas(program_line_id)`,
  `CREATE INDEX IF NOT EXISTS idx_takas_location ON takas(location_id)`,
  `CREATE INDEX IF NOT EXISTS idx_receipts_po ON grey_receipts(po_id)`,
  // --- branches + item master (additive) ---
  `CREATE TABLE IF NOT EXISTS branches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, city TEXT, address TEXT, phone TEXT)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, quality_id INTEGER NOT NULL, shade_id INTEGER, notes TEXT)`,
  // --- client changes 1 (additive) ---
  `CREATE TABLE IF NOT EXISTS quality_shades (id INTEGER PRIMARY KEY AUTOINCREMENT, quality_id INTEGER NOT NULL, shade_id INTEGER NOT NULL, active INTEGER DEFAULT 1, added_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS mill_challan_mains (id INTEGER PRIMARY KEY AUTOINCREMENT, main_no INTEGER NOT NULL, date TEXT, mill_id INTEGER NOT NULL, notes TEXT, status TEXT DEFAULT 'OPEN', created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS taka_damages (id INTEGER PRIMARY KEY AUTOINCREMENT, taka_id INTEGER NOT NULL, meters REAL NOT NULL, image_url TEXT, voice_url TEXT, voice_local INTEGER DEFAULT 0, notes TEXT, at TEXT NOT NULL)`,
  // --- client changes 2: job work, withdrawals, grey sales (additive) ---
  `CREATE TABLE IF NOT EXISTS job_workers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, city TEXT, gstin TEXT, notes TEXT)`,
  `CREATE TABLE IF NOT EXISTS job_work_challans (id INTEGER PRIMARY KEY AUTOINCREMENT, jw_no INTEGER NOT NULL, date TEXT, job_worker_id INTEGER NOT NULL, job_type TEXT, order_id INTEGER, notes TEXT, status TEXT DEFAULT 'OPEN', close_reason TEXT, closed_at TEXT, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS job_work_takas (id INTEGER PRIMARY KEY AUTOINCREMENT, challan_id INTEGER NOT NULL, taka_id INTEGER NOT NULL, quality_id INTEGER, shade_id INTEGER, sent_m REAL NOT NULL, received_m REAL, receipt_id INTEGER, status TEXT DEFAULT 'SENT')`,
  `CREATE TABLE IF NOT EXISTS job_work_receipts (id INTEGER PRIMARY KEY AUTOINCREMENT, challan_id INTEGER NOT NULL, date TEXT, ref_no TEXT, notes TEXT, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS withdrawals (id INTEGER PRIMARY KEY AUTOINCREMENT, wd_no INTEGER NOT NULL, kind TEXT NOT NULL, date TEXT, reason TEXT NOT NULL, notes TEXT, status TEXT DEFAULT 'ACTIVE', cancelled_at TEXT, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS withdrawal_takas (id INTEGER PRIMARY KEY AUTOINCREMENT, withdrawal_id INTEGER NOT NULL, taka_id INTEGER NOT NULL, prev_status TEXT NOT NULL, meters REAL)`,
  `CREATE TABLE IF NOT EXISTS grey_sales (id INTEGER PRIMARY KEY AUTOINCREMENT, gs_no INTEGER NOT NULL, date TEXT, customer_id INTEGER NOT NULL, weaver_id INTEGER NOT NULL, rate REAL, notes TEXT, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS grey_sale_takas (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, taka_id INTEGER NOT NULL, meters REAL NOT NULL)`,
  // --- client changes 5: payments received against customer orders (additive) ---
  // WhatsApp payment reminders: message templates with {Field} placeholders (see src/lib/whatsapp.js)
  `CREATE TABLE IF NOT EXISTS message_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, body TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS order_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, date TEXT NOT NULL, amount REAL NOT NULL, mode TEXT, ref_no TEXT, notes TEXT, created_at TEXT)`,
]

// Columns added after the first release: applied with ALTER TABLE only when missing (see client.js).
export const COLUMNS = [
  ['locations', 'branch_id', 'INTEGER'],
  ['grey_receipts', 'branch_id', 'INTEGER'],
  ['takas', 'branch_id', 'INTEGER'],
  ['program_lines', 'item_id', 'INTEGER'],
  ['order_lines', 'item_id', 'INTEGER'],
  ['order_lines', 'meters', 'REAL'],
  ['mills', 'gstin', 'TEXT'],
  ['customers', 'gstin', 'TEXT'],
  ['shades', 'image_url', 'TEXT'],
  ['shades', 'quality_id', 'INTEGER'],
  ['shades', 'active', 'INTEGER DEFAULT 1'],
  ['mill_dispatches', 'main_id', 'INTEGER'],
  ['mill_dispatches', 'receipt_id', 'INTEGER'],
  ['mill_dispatches', 'suffix', 'TEXT'],
  // client changes 2
  ['takas', 'jw_challan_id', 'INTEGER'],
  ['takas', 'jw_type', 'TEXT'],
  ['takas', 'jw_return_meter', 'REAL'],
  ['takas', 'grey_sale_id', 'INTEGER'],
  ['orders', 'job_work', 'INTEGER DEFAULT 0'],
  ['orders', 'job_type', 'TEXT'],
  ['orders', 'job_notes', 'TEXT'],
  // client changes 3: programs against weaver challans, lot numbers
  ['program_lines', 'quality_id', 'INTEGER'],
  ['program_lines', 'receipt_id', 'INTEGER'],
  ['program_lines', 'lot_no', 'TEXT'],
  ['takas', 'lot_no', 'TEXT'],
  // client changes 5: GST number on firms, order rate (per meter) + payment reminder days (NULL = the settings default)
  ['weaver_groups', 'gstin', 'TEXT'],
  ['orders', 'rate', 'REAL'],
  ['orders', 'payment_days', 'INTEGER'],
]

// Run after SCHEMA. `optional` ones may fail on their own (e.g. a unique index when old data has duplicates).
export const MIGRATIONS = [
  { sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_takas_receipt_no ON takas(receipt_id, taka_no)`, optional: true },
  { sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_no ON grey_pos(po_no)`, optional: true },
  { sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_items_code ON items(code)`, optional: true },
  { sql: `CREATE INDEX IF NOT EXISTS idx_takas_branch ON takas(branch_id)` },
  // client changes 1
  { sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_quality_shades ON quality_shades(quality_id, shade_id)`, optional: true },
  { sql: `CREATE INDEX IF NOT EXISTS idx_qs_shade ON quality_shades(shade_id)` },
  { sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_mains_no ON mill_challan_mains(main_no)`, optional: true },
  { sql: `CREATE INDEX IF NOT EXISTS idx_dispatch_main ON mill_dispatches(main_id)` },
  { sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_damage_taka ON taka_damages(taka_id)`, optional: true },
  { sql: `CREATE INDEX IF NOT EXISTS idx_shades_quality ON shades(quality_id)` },
  // client changes 2
  { sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_jw_no ON job_work_challans(jw_no)`, optional: true },
  { sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_wd_no ON withdrawals(wd_no)`, optional: true },
  { sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_gs_no ON grey_sales(gs_no)`, optional: true },
  { sql: `CREATE INDEX IF NOT EXISTS idx_jwt_challan ON job_work_takas(challan_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_jwt_taka ON job_work_takas(taka_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_jwr_challan ON job_work_receipts(challan_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_wdt_withdrawal ON withdrawal_takas(withdrawal_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_wdt_taka ON withdrawal_takas(taka_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_gst_sale ON grey_sale_takas(sale_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_gst_taka ON grey_sale_takas(taka_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_takas_jwc ON takas(jw_challan_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_jwc_order ON job_work_challans(order_id)` },
  // client changes 3
  { sql: `CREATE INDEX IF NOT EXISTS idx_pl_program ON program_lines(program_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_pl_receipt ON program_lines(receipt_id)` },
  // client changes 5
  { sql: `CREATE INDEX IF NOT EXISTS idx_op_order ON order_payments(order_id)` },
  // hidden chart used by every new shade / program (the charts UI is gone but chart_id stays NOT NULL)
  { sql: `INSERT INTO shade_charts (name) SELECT '__library__' WHERE NOT EXISTS (SELECT 1 FROM shade_charts WHERE name='__library__')` },
  // every (quality, colour) pair already used becomes a quality colour
  { sql: `INSERT INTO quality_shades (quality_id, shade_id, active, added_at)
    SELECT x.q, x.s, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM (
      SELECT quality_id AS q, shade_id AS s FROM items WHERE shade_id IS NOT NULL
      UNION SELECT COALESCE(pl.quality_id, pr.quality_id), pl.shade_id FROM programs pr JOIN program_lines pl ON pl.program_id=pr.id
      UNION SELECT o.quality_id, ol.shade_id FROM orders o JOIN order_lines ol ON ol.order_id=o.id
    ) x WHERE NOT EXISTS (SELECT 1 FROM quality_shades z WHERE z.quality_id=x.q AND z.shade_id=x.s)` },
  // WhatsApp payment reminders: two starter templates, only while there are none
  { sql: `INSERT INTO message_templates (name, body)
    SELECT 'Polite reminder', 'Dear {Customer name},' || char(10) || char(10) || 'This is a gentle reminder that a payment of {Amount due} is pending against order {Order no} ({Quality}).' || char(10) || char(10) || 'Kindly arrange the payment at the earliest. Thank you.'
      WHERE NOT EXISTS (SELECT 1 FROM message_templates)
    UNION ALL
    SELECT 'Detailed reminder', 'Dear {Customer name},' || char(10) || char(10) || 'Payment of {Amount due} for order {Order no} is pending (due date: {Due date}). Billed so far: {Billed amount}, received: {Received}.' || char(10) || char(10) || 'Please clear it at the earliest.'
      WHERE NOT EXISTS (SELECT 1 FROM message_templates)` },
]

export const TABLES = [
  'message_templates', 'order_payments', 'grey_sale_takas', 'grey_sales', 'withdrawal_takas', 'withdrawals', 'job_work_receipts', 'job_work_takas', 'job_work_challans', 'job_workers',
  'taka_damages', 'quality_shades', 'mill_challan_mains', 'taka_moves', 'items', 'branches', 'order_lines', 'orders', 'finished_receipts', 'program_lines', 'programs', 'mill_dispatches', 'takas',
  'grey_receipts', 'grey_pos', 'shades', 'shade_charts', 'locations', 'qualities', 'customers', 'mills', 'weavers', 'weaver_groups',
]
