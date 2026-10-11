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
