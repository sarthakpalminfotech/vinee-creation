# Vinee Creation: client changes, round 3 (dyeing program against weaver challans, lot-wise mill receipt, taka display, tablet-first layout)

You are working on **Vinee Creation**, a textile trading ERP (React 19 + Vite + Tailwind, JavaScript, client-only). All data access and every business rule live in `src/db/repo.js`, running on sql.js (local) or Turso (browser-direct) through `src/db/client.js`. The project docs (`docs/` SPEC, AUDIT, PROGRESS, MIGRATIONS, tasks/) are the authority, and `AGENTS.md` is the entry point.

Rounds 1 and 2 are done and their rules stay in force:

- colour library + quality colours
- main/sub mill challans against weaver challans
- shortage chain grey → finished → folded
- damage and sellable meters
- job work, withdrawals, grey sell and sell history
- `INACTIVE_STATUSES` and `schema_version` 4
- batched writes (≤ about 20 statements per big save)
- the error boundary
- `npm test` + `npm run test:libsql`

This round has three parts:

1. **Dyeing program** issued against **weaver challans**, with takas tapped and given a shade.
2. **Mill receipt** by weaver challan, with a **lot number**.
3. **One consistent, clean taka display**, and a properly **tablet-first** layout everywhere.

**Read this whole document and `docs/SPEC.md` before touching any code.**

---

## 0. Safety rules (these win over everything else)

1. **Never touch the real database.**
   - `.env.local` points to the client's Turso database.
   - `.env.development.local` and `.env.localtest.local` (git-ignored, empty Turso values) keep `npm run dev` and `--mode localtest` in **local mode**. Check that both exist and that Settings shows **LOCAL**.
   - Never run plain `npm run build` / `npm run preview`.
   - Never print, copy or commit the values in `.env.local`, `env 1.download` or `test-db.js`.
2. **Git: the owner commits, not you.**
   - Don't commit, don't create branches, don't push.
   - First, back up `src/`, `tests/`, `docs/`, `package.json` and `package-lock.json` to `../vinee-backup-<YYYY-MM-DD-HHmm>/`, and record the location in `docs/PROGRESS.md`.
   - Never discard the existing uncommitted work.
3. **Additive, idempotent migrations only.**
   - Allowed: new tables, nullable columns, indexes.
   - Not allowed: drop, rename or retype; deleting or rewriting existing business rows (filling a *new* column is fine).
   - Bump `SCHEMA_VERSION` 4 → 5.
   - Every migration must be safe on the client's Turso database at its next open. Write each undo step in `docs/MIGRATIONS.md`.
4. **Baseline first.** Run `npm install`, `npm test`, `npm run test:libsql`, `npm run lint` and `npx vite build --mode localtest`, and record them under "Session 5 (client changes 3)" in `docs/PROGRESS.md`. Every passing test must still pass at the end. Tests you rewrite because a rule changed must be listed.
5. **Change carefully.**
   - No unrelated refactors.
   - No new npm dependencies in `package.json`. For viewport testing you may use Playwright through `npx` without adding it (see §5).
   - Before changing shared code (`ui.jsx`, `kit.jsx`, `DocPreview.jsx`, `repo.js` helpers), find every place that uses it and re-check those places.
   - Existing URLs keep working.
6. **Every rule lives in `repo.js`,** in **one transaction** with status checks (`requireTakas` / `updateTakas`). Every status change writes `taka_moves`. A 500-taka save stays within about 20 statements.
7. **After each step:** run both test modes, lint and the `localtest` build, and open the affected screens in local mode with no console errors. If something that worked breaks, fix it or restore it from your backup.
8. **When unsure about something hard to undo, stop and ask.** Otherwise choose the simplest safe option and record it under "Decisions" in `docs/SPEC.md`.

---

## 1. Dyeing program: issue against weaver challans

### 1.1 Business rules (settled with the client)

- **One program = one mill**, and it can hold **several qualities and several weaver challans**.
- Takas come only from **grey at that mill** (`MILL_GREY`, `mill_id` = the program's mill). That includes takas sent with our mill challans and takas the weaver delivered **directly to that mill**.
- **The user chooses the exact takas.** There is no more first-in-first-out auto-picking and no "Takas in this program" check field.
- **Shades** come from the **active colours of the taka's quality** (quality colours, round 1).
- Within one weaver challan the user can give different takas different shades, e.g. 12 takas → shade 37 and 8 takas → shade 39. Takas left without a shade stay grey at the mill.
- **Add more takas:** while a program is not fully received (status not Done), the user can add more takas to it. It's the same builder screen, with the new parts appended.
- **Old programs** (made with the old auto-picking, one quality, no weaver challan) stay readable and receivable as they are.

### 1.2 Data model (additive)

- **`program_lines`:** new nullable columns
  - `quality_id INTEGER`
  - `receipt_id INTEGER`: the weaver challan
  - `lot_no TEXT`: see §2

  A new-style line = **one weaver challan + one shade** in one program; `taka_count` = its number of takas. Old lines keep NULL `receipt_id`, and their quality is the program's.
- **`programs.quality_id`** stays NOT NULL in the schema. For new programs, store the quality of the first line. **Never** read `programs.quality_id` as "the quality of the program" any more. Use `COALESCE(pl.quality_id, pr.quality_id)` everywhere. Known places to fix (search for `pr.quality_id` and `JOIN qualities q ON q.id=pr.quality_id`):
  - `QC_SQL` "last program" + used count (around line 208)
  - `removeQualityColour` used-check (around line 258)
  - `PG_SQL` (around line 917)
  - `FR_SQL` (around line 984)
  - the `quality_shades` backfill in `schema.js`
  - the shrinkage report / availability / inventory / dashboard queries
  - any program list filter by quality

  A program with several qualities shows them all (e.g. "Gold Lava, Silver Lava").
- **Indexes:** `program_lines(program_id)`, `program_lines(receipt_id)`.

### 1.3 Repo functions

- **`millChallansForProgram(millId, qualityId)`:** the weavers (party + group) that have `MILL_GREY` takas of that quality at that mill. For each weaver, its weaver challans that still have such takas: challan no, date, takas at mill, meters, and whether it came direct or through our mill challan (show the sub-challan no, e.g. 12B). A challan with nothing left at that mill isn't listed.
- **`programTakasOfReceipt(millId, receiptId)`:** that challan's takas still `MILL_GREY` at that mill.
- **`createProgram({ mill_id, date, notes, parts })`**, where `parts = [{ receipt_id, lines: [{ shade_id, taka_ids }] }]`. Checks:
  - every taka is `MILL_GREY`, at that mill, from that receipt
  - every shade is linked **and active** for that receipt's quality
  - no taka appears twice
  - at least one taka overall

  It creates the program (`PG-…` numbering as now) plus one `program_lines` row per receipt + shade, moves the takas to `IN_DYEING` with `program_line_id`, and writes `taka_moves`, all in one transaction. **Keep the old signature working** (`{ mill_id, quality_id, date, lines: [{ shade_id, taka_count }] }` → old auto-picking) only for existing tests and scripts. The UI must use the new one.
- **`addToProgram(programId, parts)`:**
  - same checks
  - allowed only while the program is not Done and the takas are at **the program's mill**
  - a receipt + shade that already has a line in this program **extends that line**: append the takas, `taka_count` grows, and the lot number (if any) stays

### 1.4 Screens

**Step 1: program details** (full screen, `/programs/new`)
- Fields: mill (required), date (today), notes, and the program no shown (auto).
- **Next** opens step 2.

**Step 2: takas and shades** (full screen, same route, its own step; Back keeps the data)

Cascading pickers at the top of the active card:
1. **Quality**: only qualities with grey at this mill.
2. **Weaver (party)**: only those with grey of that quality at this mill.
3. **Weaver challan**: only that weaver's challans with takas still at this mill. Each option shows challan no, date, takas at mill, meters, and "direct" or "via 12B".

Once a challan is chosen, the card shows its **available takas as a tap grid** (see §3 for how a taka looks):
- tap to select/unselect
- **Select all**, **First N**, **Clear**
- a live "12 selected · 1,201.50 m"

**Choose colour** (enabled when ≥ 1 taka is selected) opens a clean sheet:
- the quality's active colours as large swatch/image tiles with the shade name, plus search
- tap a colour → the selected takas get that shade and **leave the available grid**
- they appear in an **"Assigned"** list under the grid, grouped by shade: swatch, shade name, takas, meters, with **Change colour** and **Remove** (remove puts the takas back into the grid)

The user repeats this for more shades of the same challan.

**Done with this challan** collapses the card to one clean line:

`WC-55 · Ganesh Fabrics · Gold Lava · ● 37 × 12 (1,201.50 m) · ● 39 × 8 (802.00 m)`

with **Edit** (re-expands) and **Remove**.

**+ Add another weaver challan** opens a new card (the previous one collapses). The user can change quality, weaver or challan freely. The same challan can't be open in two cards: picking it again re-opens its existing card.

**Summary:**
- On **desktop/laptop**: a right column.
- On **tablet**: a sticky bottom bar.
- It shows challans, takas, meters and per-shade totals as small swatch chips, plus **Submit**.

**Confirm modal on Submit**, grouped by **quality → weaver challan** (challan no, party): one row per shade with swatch, shade name, takas and meters; a subtotal per challan; then **totals per shade across the whole program**; then the grand total. **Confirm & issue** saves everything in one transaction.

**Add more takas** on an open program uses the same step 2 with the program's mill fixed. Existing lines are shown read-only above the new cards.

**Program detail** (`/programs/:id`) has:
- **Header:** program no, mill (+ GSTIN), date, status (Pending / Partly received / Done), totals (takas issued / received / pending, meters).
- A **per-shade summary** row of swatch chips with takas and received/pending.
- **Body grouped by quality → weaver challan:**
  - a collapsible section per challan showing party, challan no, and "direct" or "via sub-challan"
  - inside it, one row per shade: swatch + name, **lot no** (or "—"), issued / received / pending takas, grey m, finished m, mill shortage m and %
  - an expandable taka list for each shade (§3 style), with each taka's state (in dyeing / received)
- **Buttons:** **Receive from mill**, **Add more takas** (hidden when Done), **Print / Share program**, and the mill receipts list (return challan no, date, takas, lot nos).

**Program PDF** (via `DocPreview`, mill-facing, so the quality **nickname** only):
- Header: program no, mill, date.
- Grouped by quality → weaver challan no → shade, with the **colour swatch or image printed**, takas and meters per shade, and a taka list (§3).
- Totals per shade across the program, then the grand total.
- Paginated cleanly: a section never splits a row in half.

**Program list:**
- Show the qualities (several possible), number of weaver challans, takas issued/received, colour chips, and status.
- Keep the filters, with the quality filter matching any line's quality.

---

## 2. Receiving from the mill: by weaver challan, with lot number

### 2.1 Rules

- A mill receipt (the mill's return challan) belongs to **one program** and can cover **several weaver challans** and shades. Partial receipts are allowed, any number of times.
- **Required on every received taka:** the **finished meters** (mill shortage = grey − finished, unchanged).
- **Lot number:**
  - one lot no per **program line** (= program + weaver challan + shade)
  - required when any taka of that line is received
  - the first receipt sets it (`program_lines.lot_no`)
  - later receipts of the same line show it **prefilled and locked**, and `repo` rejects a different value
  - the same lot text may appear on different lines (the mill decides)
  - old-style lines (no `receipt_id`) also get one lot no per line
- **Keep the lot number on the taka too:** add a nullable `takas.lot_no`, set on receipt, so folding, inventory, damage details, job work and sales can show and search it without joins.

### 2.2 Repo

- **`createFinishedReceipt({ program_id, challan_no, date, notes, image_url, lines: [{ program_line_id, lot_no, rows: [{ id, finished_meter }] }] })`**, in one transaction. Checks:
  - every taka is `IN_DYEING` and belongs to that line, and the line belongs to that program
  - lot rules as above
  - finished meters > 0 with ≤ 2 decimals

  It sets `FINISHED`, `finished_meter`, `mill_grey_meter = grey_meter`, `finished_receipt_id` and `lot_no`, and writes `taka_moves` (note includes the lot), in batches.
- **Keep the old row-only signature working** for old tests: a missing `lot_no` is allowed only through the old signature, and the UI never uses it.

### 2.3 Screen (`/programs/:id/receive`)

**Step 1:**
- mill return challan no (required), date (today), notes, optional photo (`ImagePicker`)
- **Next**

**Step 2: weaver-challan cards**, the same pattern as the program builder.

Pick a weaver challan, from those of this program with pending takas. Old-style lines are offered as "Shade 37 (old program)".

The card shows that challan's pending takas **grouped by shade**. Each shade group has:
- the swatch + name
- a **Lot no** field (locked with a lock icon if already set)
- a tap grid of pending takas with Select all / First N / Clear
- for every selected taka, a **finished meters** input next to it (Enter moves to the next one)
- a **Paste** button for that group: one meter per line, filled into the selected takas in order
- live grey, finished and shortage for the group

**Done** collapses the card:

`WC-55 · Gold Lava · 37: 10 takas, lot L-778 · 39: 6 takas, lot L-779`

**+ Add another weaver challan** opens a new card.

**Confirm modal:** per weaver challan → shade with lot no, takas, grey m, finished m and shortage; the grand total. **Confirm & receive** saves everything in one transaction.

### 2.4 Lot number elsewhere

- **Folding:** show the lot no per taka and per mill challan card; search by lot.
- **Inventory detail:** a lot column and search.
- **Damage details:** the lot no.
- **Job work and grey sale / FG withdrawal detail:** the lot no where takas are listed.
- **Availability per colour:** the lots in stock, as small chips.

---

## 3. One clean taka display (everywhere)

**What the client said:** the taka number / serial (1, 2, 3…) is not important and is currently bold and eye-catching. **The meters are what matter.** In multi-column taka lists, the taka number of one column visually runs into the meters of the column before it.

**Build two shared pieces** (in `components/kit.jsx` or a new `components/TakaGrid.jsx`) and use them on **every** screen and PDF that lists takas.

**`TakaChip`** (a tap tile):
- **Meters** are the main text: large, semibold, tabular numbers, e.g. **102.58** with a small "m".
- The **taka no** is small and muted (`text-[11px] text-slate-400`), top-left, prefixed "#".
- Selected state: maroon border + light tint + a small check; disabled state: greyed.
- Optional tiny badges (lot, damaged, job-worked) sit on one line below, never pushing the meters aside.
- Minimum touch size 44 px.
- The grid is responsive (about 4 columns on iPad portrait, 6 on landscape and laptop, 3 on phone), and every tile has the same width.

**`TakaList`** (read-only lists and PDFs):
- The takas sit in **column blocks**. Each block is its own bordered or tinted box with its own small header ("No · Meters").
- There's **clear space plus a vertical divider between blocks** (not between the number and the meters inside a row), so one block's numbers never sit next to another block's meters.
- Inside a row: taka no small and muted, left-aligned; meters right-aligned, semibold, tabular, in a fixed-width column.
- Light zebra rows.
- A footer per block (takas · meters) and a grand total.
- On screen the number of blocks follows the width. In PDFs use a fixed number of blocks per A4 page.

**Apply them to:**
- the grey challan entry grid: keep its table, but meters as the dominant column and the taka no muted
- receipt detail
- the mill challan part cards (`PartBuilder`), mill challan detail and mill challan PDF (cover and sub pages)
- the program builder, program detail and program PDF
- mill receipt
- folding
- the job work form/receive/detail/PDF
- the grey sell picker (`GreyTakaPicker`), grey sale detail/PDF
- withdrawal detail
- inventory detail, where the table stays a table but follows the same emphasis
- the damage details modal

**Search for `taka_no}` and `{t.label}`** to find them all, and list in PROGRESS.md every place changed.

---

## 4. Tablet-first layout (iPad / tablet / laptop)

The client works mainly on **iPad and tablets (portrait and landscape) and laptops**. Phones must not break.

**Rules for every screen touched this round, and a check of every other main screen:**
- No sideways page scroll at any width. Wide tables scroll inside their own card only, and the main ones (taka grids, cards) need no sideways scroll at all.
- Use breakpoints deliberately: `md` (768) tablet portrait, `lg` (1024) tablet landscape / small laptop, `xl` (1280) laptop.
  - Two-column layouts (form + summary) start only at `lg`.
  - Below that the summary becomes a sticky bottom bar that never covers inputs (add bottom padding equal to the bar height).
- Touch targets ≥ 44 px. Inputs use 16 px text, so iPad Safari doesn't zoom.
- Date inputs keep the existing iOS fix.
- Modals and sheets fit the screen height (with internal scroll), and on tablet portrait they may be full-width bottom sheets.
- The sidebar drawer behaviour stays as it is.
- Long names truncate with an ellipsis instead of pushing layouts wider. Numbers never wrap mid-value.
- Safari / iPadOS check: no `:has()`-only layouts for the UI, and no hover-only actions (every action must be reachable by tap).

---

## 5. Tests and checks

**`tests/e2e.mjs`, both drivers.** Add checks for:
- **Picker lists:**
  - the cascading lists return only qualities, weavers and challans with grey at that mill, including direct-to-mill challans
  - a challan with nothing left at the mill isn't listed
- **`createProgram` (new):**
  - 2 qualities, 3 weaver challans, 2 shades in one challan
  - lines per receipt + shade; takas `IN_DYEING`
  - rejected: a taka at another mill, a taka from another receipt, an inactive or unlinked colour, a duplicate taka
  - a failed save leaves no rows
- **`addToProgram`:**
  - extends the same receipt + shade line and adds new lines
  - refused when the program is Done
- **Multi-quality:**
  - the program list shows all qualities
  - "last program" for a quality colour still works
  - the shrinkage, availability and inventory numbers are unchanged for single-quality data (regression)
- **Receipt:**
  - partial receipt with lot nos per line
  - a second receipt of the same line with a different lot is rejected; the same lot is accepted
  - takas get `lot_no`
  - pending per line and per shade is right
  - the program becomes Done after the last receipt
- **Old programs:** an old-style program can still be received (lot per line)
- **Batching:** a 500-taka program issue and receipt stay within the statement limit
- **Reconciliation:** inventory still reconciles

**Viewport check (this was not verified in rounds 1 and 2; it must be done this time):**
- Use Playwright through `npx` (don't add it to `package.json`; use the system Chromium if one exists) against the `localtest` preview.
- Set exact viewports: **768×1024, 1024×768, 820×1180, 1180×820, 1280×800, 1440×900, and 390×844** (phone sanity).
- For every main route (dashboard, PO, grey challan new/detail, mill challan new/detail, program new step 1 + step 2 with a part, program detail, receive, folding, job work, inventory + detail, orders new, availability, masters), assert `document.documentElement.scrollWidth <= window.innerWidth` and save a screenshot to `docs/screens/<route>-<w>x<h>.png`.
- Look at the screenshots and fix anything broken or crowded. List the results in PROGRESS.md.
- If Playwright truly can't run, say so clearly in the final report. Don't claim the widths were checked.

---

## 6. Seed

Update `src/db/seed.js` (only into an empty **local** database) so it includes:
- one new-style program with 2 qualities, 3 weaver challans (one of them direct-to-mill) and 2 shades in one challan
- a partial receipt with lot numbers, and a second receipt reusing a lot
- one old-style program kept as it is

---

## 7. Order of work

1. Backup + baseline.
2. Data: columns, indexes, `SCHEMA_VERSION` 5, `COALESCE(pl.quality_id, pr.quality_id)` everywhere; existing tests green in both modes.
3. Repo: picker queries, `createProgram` (new), `addToProgram`, and `createFinishedReceipt` with lots; tests.
4. `TakaChip` / `TakaList` components.
5. Program builder (step 1 + step 2, colour sheet, collapsing cards, summary, confirm).
6. Program detail + PDF + list.
7. Receive screen with lots.
8. Lot number in folding, inventory, damage, job work, sales and availability.
9. Apply the taka display to all other screens and PDFs (§3).
10. Tablet layout pass (§4) + the viewport checks (§5) + fixes.
11. Seed, all tests (both drivers), lint, `localtest` build, and a full browser walk-through:
    1. mill challan
    2. program with 2 qualities / 3 challans / several shades
    3. add more takas
    4. partial receive with lots
    5. second receive with a locked lot
    6. folding showing lots
    7. inventory
    8. order availability
12. Docs (§8).

---

## 8. Docs

- **`docs/SPEC.md`:**
  - rewrite **R-PG-1..4**: program against weaver challans, several qualities, takas chosen by the user, shades from quality colours, add more
  - rewrite **R-FR-1..4**: receipt by weaver challan, lot per program line, finished meters
  - add **R-UI-1**: the taka display rule (meters first, taka no muted, column blocks)
  - add **R-UI-2**: the tablet-first layout rules
  - add decisions for lot locking and `programs.quality_id` meaning "first line's quality"
  - open questions: editing or cancelling a program line after issue, and lot number format
- **`docs/AUDIT.md`:** a section "Client changes 3" with traceability rows.
- **`docs/MIGRATIONS.md`:** the new columns and indexes, each with its undo; `schema_version` 5.
- **`docs/tasks/06-program.md`** and **`07-mill-receipt-folding.md`**: updated.
- **`docs/PROGRESS.md`:** a Session 5 log covering the backup, baseline, final results, the taka-display places changed, the viewport results with the screenshot folder, and anything not verified.

---

## 9. Final report

A short summary covering:
- what was built
- the queries changed for multi-quality programs
- test results (both drivers), lint, build
- the viewport results (per width: pass/fixed)
- anything not done or not verified, and why
- the open questions
