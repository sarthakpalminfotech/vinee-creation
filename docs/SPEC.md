# Vinee Creation — Business spec (authority: audit brief §2)

Vinee Creation is a textile **trader**: orders grey fabric from weavers, has it dyed/finished at mills, folds it, sells it to customers. Everything is counted in **taka** (roll) and **meters** (2 decimals).

## Rules (IDs are used in AUDIT.md and code comments)

**Masters** — R-M-1 party group → parties (POs go to the group, goods come from a party). R-M-2 quality has an *original name* (weaver documents) and a *nickname* (mills, customers: challans, programs, order screens). R-M-3 mills. R-M-4 shop → rack. R-M-5 shade chart → shade numbers with colour (hex). R-M-6 customers.
**Grey PO** — R-PO-1 party group, quality, ordered meters, rate, PO number typed from the paper PO. R-PO-2 ordered/received/pending + status **Open / Partly received / Received / Closed (short)**. R-PO-3 partial receipts from any party of the group. R-PO-4 weaver shrinkage = ordered − received (m and %).
**Receiving grey** — R-GR-1 party, weaver challan no + date, destination godown or direct to a mill. R-GR-2 many takas, meters ≤ 2 decimals, fast grid, unique taka no within the challan. R-GR-3 updates the PO. R-GR-4 direct receipts go straight to *grey at mill* (never godown/rack).
**Racks** — R-LOC-1 bulk-assign takas to one rack. R-LOC-2 move later, history kept. R-LOC-3 stock by shop → rack.
**Send to mill** — R-SM-1 pick takas (whole challan or part). R-SM-2 picking list grouped by rack (screen + print). R-SM-3 mill challan: mill, **nickname**, takas, totals, printable. R-SM-4 takas leave the godown and become grey at mill. R-SM-5 no double send; one transaction.
**Program** — R-PG-1 program in takas for a quality + chart. R-PG-2 split across shades, adds up. R-PG-3 program PDF: shades with colours, takas and meters. R-PG-4 only grey at *that mill*.
**Mill receipt** — R-FR-1 refers to the program; grey and finished meter per taka. R-FR-2 finishing shrinkage per taka and total. R-FR-3 partial returns, pending per shade. R-FR-4 received takas become finished goods.
**Folding** — R-FD-1 enter real folded meters. R-FD-2 folding shrinkage = finished − folded. R-FD-3 folded meters are the stock/sales meters.
**Shrinkage report** — R-SH-1 per taka chain weaver grey → finished → folded, loss per step and total. R-SH-2 direct-to-mill takas start at the mill's grey meter. R-SH-3 summaries by PO, party, quality, mill, program; PO weaver shrinkage.
**Inventory** — grey at our place · grey at mill · in dyeing · finished goods; filters quality/party group/party (+ mill, shade, rack); counts and meters; the four views add up to all active takas.
**Availability** — R-SO-1 for a quality (nickname) and each requested shade: finished, in dyeing (program/mill), grey at mill, grey at our place.
**General** — R-G-1 clean responsive UI. R-G-2 lists have search/filter/pagination/loading/empty/error states. R-G-3 inline validation, no double submit. R-G-4 exact 2-dp meters. R-G-5 every multi-row change is one transaction. R-G-6 taka state machine with full history; invalid transitions rejected by the code, not just hidden in the UI.

## Taka state machine (enforced in `src/db/repo.js`, logged in `taka_moves`)
`GODOWN_GREY` → (rack assign/move stays in state) → `MILL_GREY` (send to mill) → `IN_DYEING` (program) → `FINISHED` (mill receipt) → `FOLDED` → `SOLD` (order allocation).
Direct receipts start at `MILL_GREY`. Each transition requires the exact previous state and aborts the whole transaction otherwise.

## Decisions taken by the audit (change by editing the named place)
- **D-1 Decimals:** columns stay `REAL` (no destructive retype). Every meter is validated to ≤2 dp and rounded on write; all SQL sums use `ROUND(…,2)`, JS sums use integer hundredths. Meters never exceed a few thousand per row so no drift is possible at 2 dp.
- **D-2 No server:** the app is client-only; `repo.js` is the enforcement layer, wrapped in `tx()` (`src/db/client.js`; SQL transaction on sql.js and Turso).
- **D-3 Shrinkage chain:** start = weaver challan meter (mill grey meter for direct receipts); total = start − (folded ?? finished). The older "nominal length − grey" figure is kept only as informational "vs nominal".
- **D-4 Closing a PO short** freezes further receipts; "Re-open PO" reverses it. A *Received* (fully delivered) PO still accepts more meters (over-delivery shows as negative shortage).
- **D-5 Duplicates:** taka numbers unique per challan (DB unique index + code). PO number unique. Masters: case-insensitive duplicate names/racks/shade numbers rejected.
- **D-6 Racks only for grey in our godown** (the old screen racked folded goods; where finished/folded stock sits is Q8). On sending to the mill the rack is cleared; the rack at the time is kept in history and used for the picking list.
- **D-7 Program allocation** takes takas first-in-first-out from grey at that mill for the chosen quality (one quality per program).
- **D-8 Customer orders:** the existing "allocate → SOLD" button is kept as generated; availability checking does not depend on it (Q6).
- **D-9 Demo data** is only written into a completely empty *local* database, never a remote one unless `VITE_ALLOW_DEMO_SEED=true`; "Reset demo data" is disabled on remote databases.

## Open questions (safest behaviour chosen — answer to change)
1. Taka numbers: unique per challan today. System-wide or per party?
2. Closing a PO short freezes receipts (D-4) — correct?
3. Can one program mix qualities? (today: one quality)
4. Can a mill return challan split a taka (partial taka)? (today: whole takas)
5. Roles/logins: none exist; who may do what?
6. Orders: only an availability check, or also booking/reserving stock? (today the generated "allocate to SOLD" remains)
7. Mill dyeing rates and sale rates needed now? (not implemented)
8. Should finished/folded stock also have a rack/location?
9. Weaver challan number: must it be unique per party?
10. Should meters ever move to integer hundredths storage (needs a data migration, so it needs your OK)?
