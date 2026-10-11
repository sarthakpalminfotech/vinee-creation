// Single SQL schema used by both Turso (remote libSQL) and local sql.js.
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
]

// Run after SCHEMA; each is allowed to fail (e.g. old data violates the new unique rule).
export const MIGRATIONS = [
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_takas_receipt_no ON takas(receipt_id, taka_no)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_no ON grey_pos(po_no)`,
]

export const TABLES = [
  'taka_moves', 'order_lines', 'orders', 'finished_receipts', 'program_lines', 'programs', 'mill_dispatches', 'takas',
  'grey_receipts', 'grey_pos', 'shades', 'shade_charts', 'locations', 'qualities', 'customers', 'mills', 'weavers', 'weaver_groups',
]
