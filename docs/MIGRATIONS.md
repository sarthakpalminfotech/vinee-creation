# Database migrations

The schema in `src/db/schema.js` is applied on start-up with `CREATE … IF NOT EXISTS`, so migrations are additive only. The audit made **no destructive change** (no drop/rename/retype/delete).

| Added | What | Undo |
|---|---|---|
| table `taka_moves` | history of every taka movement (receipt, rack assign/move, send, program, mill receipt, folding, order) | `DROP TABLE taka_moves;` (only loses history) |
| indexes `idx_moves_taka`, `idx_moves_ref`, `idx_takas_dispatch`, `idx_takas_line`, `idx_takas_location`, `idx_receipts_po` | lookup speed | `DROP INDEX <name>;` |
| unique index `ux_takas_receipt_no` on `takas(receipt_id, taka_no)` | duplicate taka no inside one challan | `DROP INDEX ux_takas_receipt_no;` |
| unique index `ux_pos_no` on `grey_pos(po_no)` | duplicate PO numbers | `DROP INDEX ux_pos_no;` |

The two unique indexes are created in `MIGRATIONS` and are skipped (with a console warning) if existing data already contains duplicates; the code still checks duplicates itself.

**Backups.** Local mode keeps the database in the browser (IndexedDB) — use *Settings → Download database backup* before upgrading a browser that holds real data. For Turso take a Turso snapshot/export first. Existing rows have no history before the upgrade; the history dialog says so.
**Testing never touches real data:** `tests/` uses a fresh in-memory database.

## Client changes 1 (schema_version 3) — all additive and idempotent
They run automatically the first time the app opens a database whose `settings.schema_version` is lower. Take a snapshot/backup first. Nothing is dropped, renamed, retyped or deleted.

| Added | What | Undo |
|---|---|---|
| key `schema_version` in `settings` | start-up skips schema work when it matches the code | `DELETE FROM settings WHERE key='schema_version';` (the next start re-applies the idempotent steps) |
| columns `mills.gstin`, `customers.gstin` | optional GSTIN | `ALTER TABLE … DROP COLUMN gstin;` |
| columns `shades.image_url`, `shades.quality_id`, `shades.active` | colour photo; private colour owner; library active flag | `ALTER TABLE shades DROP COLUMN …;` (private colours would then look like library colours — delete them first) |
| table `quality_shades` + unique index `ux_quality_shades`, index `idx_qs_shade` | which colours a quality can use (+ active flag) | `DROP TABLE quality_shades;` |
| backfill rows in `quality_shades` | one row for every (quality, colour) already used in items, programs, orders | `DELETE FROM quality_shades;` (before any colour was linked by hand) |
| row `shade_charts.name='__library__'` | hidden chart behind every new colour/program (chart_id is NOT NULL) | `DELETE FROM shade_charts WHERE name='__library__';` only if no shade/program references it |
| table `mill_challan_mains` + unique index `ux_mains_no` | main mill challans | `DROP TABLE mill_challan_mains;` |
| columns `mill_dispatches.main_id`, `.receipt_id`, `.suffix` + index `idx_dispatch_main` | sub-challan = a dispatch row of a main, against a weaver challan | `ALTER TABLE mill_dispatches DROP COLUMN …;` |
| table `taka_damages` + unique index `ux_damage_taka` | damage of a folded taka (one per taka) | `DROP TABLE taka_damages;` (sellable meters then equal folded meters again) |
| index `idx_shades_quality` | lookups | `DROP INDEX idx_shades_quality;` |

Old data stays: `items` rows and `item_id` columns, `locations`, `takas.location_id`, rack history in `taka_moves`, `takas.mill_grey_meter` (now always equal to `grey_meter` for new receipts), old shade charts, mill challans without `main_id` ("Old challan").

## Client changes 2 (schema_version 4) — all additive and idempotent
Runs automatically the first time the app opens a database with `schema_version` < 4 (take a Turso snapshot first). Nothing is dropped, renamed, retyped or deleted.

| Added | What | Undo |
|---|---|---|
| tables `job_workers`, `job_work_challans`, `job_work_takas`, `job_work_receipts` | job work masters, challans, their takas and receipts | `DROP TABLE …;` (takas stuck in JOB_WORK/NOT_RETURNED must first be set back to FOLDED) |
| tables `withdrawals`, `withdrawal_takas` | "Others" withdrawals + previous status per taka | `DROP TABLE …;` (WITHDRAWN takas must first be set back to their `prev_status`) |
| tables `grey_sales`, `grey_sale_takas` | grey direct sales | `DROP TABLE …;` (GREY_SOLD takas must first be set back to GODOWN_GREY) |
| columns `takas.jw_challan_id`, `jw_type`, `jw_return_meter`, `grey_sale_id` | last job work challan, job-worked marker, received meters, grey sale | `ALTER TABLE takas DROP COLUMN …;` (sellable meters fall back to folded − damage) |
| columns `orders.job_work` (default 0), `job_type`, `job_notes` | job-work orders | `ALTER TABLE orders DROP COLUMN …;` |
| unique indexes `ux_jw_no`, `ux_wd_no`, `ux_gs_no` | integer numbers JW-n / WD-n / GS-n | `DROP INDEX …;` |
| indexes `idx_jwt_challan`, `idx_jwt_taka`, `idx_jwr_challan`, `idx_wdt_withdrawal`, `idx_wdt_taka`, `idx_gst_sale`, `idx_gst_taka`, `idx_takas_jwc`, `idx_jwc_order` | lookups | `DROP INDEX …;` |

## Client changes 3 (schema_version 5) — all additive and idempotent
Runs automatically the first time the app opens a database with `schema_version` < 5 (take a Turso snapshot first). Nothing is dropped, renamed, retyped or deleted; existing program lines keep NULL in the new columns.

| Added | What | Undo |
|---|---|---|
| columns `program_lines.quality_id`, `program_lines.receipt_id` | quality and weaver challan of a new-style line (NULL on old lines) | `ALTER TABLE program_lines DROP COLUMN …;` (new-style programs would then lose their weaver challan link) |
| column `program_lines.lot_no` | the one lot number of a program line | `ALTER TABLE program_lines DROP COLUMN lot_no;` |
| column `takas.lot_no` | lot kept on the taka, set on mill receipt | `ALTER TABLE takas DROP COLUMN lot_no;` |
| indexes `idx_pl_program`, `idx_pl_receipt` | lookups | `DROP INDEX …;` |
| changed backfill (same idempotent statement) | `quality_shades` backfill reads `COALESCE(pl.quality_id, pr.quality_id)` | nothing to undo (it only inserts missing links) |

## Client changes 5 (schema_version 6) — all additive and idempotent
Runs automatically the first time the app opens a database with `schema_version` < 6 (take a Turso snapshot first). Nothing is dropped, renamed, retyped or deleted; existing rows keep NULL in the new columns.

| Added | What | Undo |
|---|---|---|
| column `weaver_groups.gstin` | optional GST number of a firm | `ALTER TABLE weaver_groups DROP COLUMN gstin;` |
| columns `orders.rate`, `orders.payment_days` | rate per meter; the order's own payment-reminder days (NULL = the Settings default) | `ALTER TABLE orders DROP COLUMN …;` |
| table `order_payments` + index `idx_op_order` | payments received against an order (several per order) | `DROP TABLE order_payments;` |
| setting `payment_reminder_days` (row in `settings`) | default reminder days (60 when missing) | `DELETE FROM settings WHERE key='payment_reminder_days';` |

## WhatsApp payment reminders (schema_version 7) — additive and idempotent
Runs automatically the first time the app opens a database with `schema_version` < 7. Nothing is dropped, renamed, retyped or deleted. No manual command is needed.

| Added | What | Undo |
|---|---|---|
| table `message_templates` (`id`, `name`, `body`) | WhatsApp message templates (Masters → Message templates) | `DROP TABLE message_templates;` (only loses the templates) |
| two rows in `message_templates` ("Polite reminder", "Detailed reminder") | starter templates — inserted only while the table is empty | delete them in Masters → Message templates |
