# Vinee Creation: client changes, round 2 (job work, withdrawals, grey sell, sell history, inventory fix)

You are working on **Vinee Creation**, a textile trading ERP:

- **Flow:** grey PO → weaver (grey) challan → main/sub mill challan → dyeing program → mill receipt → folding (with damage) → customer orders.
- **Stack:** React 19 + Vite + Tailwind (JavaScript), client-only.
- **Data layer:** all data access and every business rule live in `src/db/repo.js`, which runs on sql.js (local) or Turso (browser-direct) through `src/db/client.js`.
- **Project docs:** the authority is `docs/` (SPEC, AUDIT, PROGRESS, MIGRATIONS, tasks/). `AGENTS.md` is the entry point.
- **Previous round:** round 1 (`vinee-client-changes-1-prompt.md`) is done. Its rules stay in force:
  - colour library + quality colours
  - main/sub mill challans
  - shortage chain grey → finished → folded
  - `taka_damages` and sellable meters
  - `schema_version`
  - batched writes (≤ ~20 statements per big save)
  - `npm test` and `npm run test:libsql`

This round adds **job work, withdrawals, grey direct sell and a sell history**, and fixes **white screens in Inventory**.

**Read this whole document and `docs/SPEC.md` before touching any code.**

---

## 0. Safety rules (these win over everything else)

1. **Never touch the real database.**
   - `.env.local` points to the client's Turso database. `.env.development.local` and `.env.localtest.local` (both git-ignored, empty Turso values) keep `npm run dev` and `--mode localtest` in **local mode**. Check that both still exist and that Settings shows **LOCAL** before working.
   - Never run plain `npm run build` / `npm run preview`.
   - Never print, copy or commit the values in `.env.local`, `env 1.download` or `test-db.js`.
2. **Git: the owner commits, not you.**
   - Don't commit, don't create branches, don't push.
   - Before the first change, make a backup copy of `src/`, `tests/`, `docs/`, `package.json` and `package-lock.json` into `../vinee-backup-<YYYY-MM-DD-HHmm>/`, and record it in `docs/PROGRESS.md`.
   - The working tree may already contain uncommitted round-1 work. That's expected; never discard it.
3. **Additive, idempotent migrations only.**
   - New tables, nullable columns, indexes, and new rows in new tables.
   - No drop, rename or retype. No deleting or rewriting existing business rows.
   - Bump `SCHEMA_VERSION` (currently 3) to 4.
   - Every migration must be safe to run automatically on the client's Turso database the next time the app opens there. Write each undo step in `docs/MIGRATIONS.md`.
4. **Record the baseline first.** Run `npm install`, `npm test`, `npm run test:libsql`, `npm run lint` and `npx vite build --mode localtest`, and write the results in `docs/PROGRESS.md` under "Session 4 (client changes 2)". Every passing test must still pass at the end. If a test has to change because a rule changed, rewrite it to the new rule and list it in PROGRESS.md.
5. **Change carefully.**
   - Touch only what a step needs. No unrelated refactors or reformatting.
   - No new npm packages or upgrades; stop and ask if one is truly needed.
   - Before changing shared code (`ui.jsx`, `kit.jsx`, `DocPreview.jsx`, `repo.js` helpers, `client.js`), find every place that uses it and re-check those places afterwards.
   - Keep existing URLs working.
6. **Keep the current look.** Maroon theme, existing components (`StatTile`, `Qty`, `ShadeSwatch`, `Chip`, `DetailList`, `Modal`, `Drawer`, `DocPreview`, `FilterButton`, `SearchToggle`, `Pager`), same spacing and typography. New screens must look like they always belonged.
7. **Screens must be clean on tablet (about 820 px) and desktop (1440 px), and usable on phone (390 px).** No sideways page scroll.
8. **Every rule is enforced in `repo.js`, not only in the UI.**
   - Each multi-row change is **one transaction** with status checks (`requireTakas` / `updateTakas` pattern).
   - Every status change writes `taka_moves`.
   - Big saves (300–500 takas) stay within about 20 statements (multi-row INSERT/UPDATE, `CASE id WHEN …`).
9. **After each step:**
   - run both test modes, lint and the `localtest` build
   - open the affected screens in local mode, with no console errors

   If something that worked breaks, fix it or revert that step (restore from your backup).
10. **When unsure about anything hard to undo, stop and ask.** Otherwise choose the simplest safe option and record it under "Decisions" in `docs/SPEC.md`.

---

## 1. Bug fix first: white screens in Inventory

**Cause found:**
- In `src/pages/inventory/InventoryDetailPage.jsx`, `stageGroups = useMemo(...)` is called **after** the early `return`s (`if (error) …`, `if (!all) …`, `if (!head) …`). The first render returns before that hook and the next render calls it, which breaks React's rules of hooks. The page crashes, so clicking a quality card or KPI that opens the detail page shows a **white screen**.
- The app has **no error boundary**, so any render error blanks the whole app.

**Fix:**
1. Move every hook in `InventoryDetailPage.jsx` above the first early return.
2. Then check **every page** for the same pattern (a hook after a conditional `return`) and fix all of them. Search each file for `useMemo`/`useState`/`useEffect`/`useCallback`/`usePaged` placed after a `return`.
3. Add an `ErrorBoundary` around the routed page content in `AppShell` (keyed by location, so navigating away resets it). It shows a friendly card: "Something went wrong on this page", the error message in small text, plus **Go back** and **Reload** buttons, and logs the error to the console. The sidebar stays usable.
4. **Totals row bug in the same table:** the red "Damaged m" footer cell shows `shownTotal.m` (stock meters) instead of the damaged total. Show the sum of `damage_m` of the shown takas there.
5. Click **every** tile, chip, card and toggle in Inventory and inventory detail for every view (godown, mill, dyeing, finished, dead, damaged, and the new views below), with and without filters. No white screen may remain. Add a test or checklist item for each.

---

## 2. Business rules for this round (the client's words, settled)

### 2.1 New taka statuses

Add these to `STATUS_META`, the state machine and every place that lists statuses:

| Status | Meaning | Counts as stock? |
|---|---|---|
| `JOB_WORK` | Folded goods out at a job worker | **Yes**: new view "FG in job work" |
| `NOT_RETURNED` | A job work taka written off when its challan was closed short | No |
| `WITHDRAWN` | Removed with "Others" (finished goods or grey); can be cancelled | No |
| `GREY_SOLD` | Grey sold directly to a customer | No (shown in sell history) |

**Allowed transitions** (anything else is rejected):
- `FOLDED → JOB_WORK` (job work withdraw)
- `JOB_WORK → FOLDED` (received back)
- `JOB_WORK → NOT_RETURNED` (challan closed short)
- `NOT_RETURNED → JOB_WORK` (challan reopened)
- `FOLDED → WITHDRAWN` (FG others)
- `GODOWN_GREY → WITHDRAWN` (grey others)
- `WITHDRAWN → <previous status>` (withdrawal cancelled)
- `GODOWN_GREY → GREY_SOLD` (grey direct sell)

**Search the whole code for `'SOLD'` and `status!=`.** Every query and filter that means "active stock" must now exclude `SOLD`, `GREY_SOLD`, `WITHDRAWN` and `NOT_RETURNED`. This covers availability, dead stock, inventory counts, dashboard, reconciliation and order allocation. Put the list in one constant (`INACTIVE_STATUSES`) and use it everywhere.

### 2.2 Finished goods withdraw: Job work

- **Only FOLDED takas** can go to job work, and only **plain** ones (not already job-worked, see 2.3). Damaged takas may go; what is sent is their **sellable meters**.
- **Form** (one screen, opened from Inventory "Withdraw" and from the Job Work module "Add"):
  - **Job worker:** required, from a new master; quick-add allowed.
  - **Job type:** **optional** free text with suggestions from earlier challans, e.g. Embroidery, Printing.
  - **Date:** prefilled with today.
  - **Notes.**
  - **Link to order:** optional, see 2.4.
- **Lines:** one or more lines of **quality + colour** (any quality, any colour; several of each allowed). On each line:
  - the available plain folded stock is shown (takas · sellable m)
  - the user enters **takas** and/or **meters** wanted
  - the **system picks the takas itself**, oldest first (by folded date, then taka id): whole takas until both the taka count and the meters are reached; the last taka may overshoot the meters, because takas are never cut
  - not enough stock → a clear error on that line
- **Preview before confirm:** a collapsible list per line of the picked takas (taka no, meters) with line totals and grand totals. **Confirm** saves everything in one transaction, moves the takas to `JOB_WORK`, and creates the **job work challan**.
- **Job work challan:**
  - number `JW-1`, `JW-2`… (integer sequence, decided inside the save, unique)
  - printable/shareable via `DocPreview` with: job worker (+ GSTIN if any), date, job type, linked order (if any), lines by quality **nickname** + colour (swatch/image + shade name) with taka list, takas and meters per line, and grand totals
  - after receipts, the PDF also shows received / pending per line

### 2.3 Receiving job work, closing, and how returned goods appear

- On a challan, **Receive** opens a screen listing the pending takas grouped by line, with:
  - Select all / First N / tap to pick
  - a **received meters** input per taka (prefilled with the sent meters)
  - receipt date (today), an optional job worker challan/ref no, and notes

  Partial receipts are allowed, any number of times. Each receive is one transaction.
- **Received takas:**
  - go back to `FOLDED` (finished goods) with the **same quality + colour**
  - are marked as **job-worked**: they carry the job type (or "Job work" when none) and the challan number
  - their **sellable meters become the received meters**
  - the difference (sent − received) is the **job work shortage**, shown on the challan and as a separate column in the shrinkage report (not part of the mill or folding shortage)
- **Challan status:**
  - **Open** (nothing received)
  - **Partly received**
  - **Completed**: set automatically when every taka is received
  - **Closed (short)**: the user closes while takas are pending; the remaining takas become `NOT_RETURNED` with a required reason
  - **Reopen** of a closed challan is allowed and moves those takas back to `JOB_WORK`
- **Job-worked stock is shown separately from plain stock** everywhere finished goods appear:
  - **Inventory finished view:** colour cards show a separate chip such as "Embroidery · 12 takas · 1,180.50 m"
  - **inventory detail:** a "Job work" column/tag and a **Plain / Job-worked** filter
  - **availability panel:** finished goods per colour split into plain and job-worked; plus "At job worker" takas/meters per colour
  - **Damage and dead-stock rules** apply as before

  A job-worked taka can't be sent to job work again (only plain takas can).

### 2.4 Orders that need job work

- **Create/Edit order:** a **"Job work required"** switch. When on, it shows an optional **job type** and a **job work note**. The order list and order detail show a "Job work: Embroidery" chip.
- **Auto-allocate:**
  - an order with job work required takes only **job-worked** FOLDED takas of that quality + colour; if the order names a job type, the type must match (case-insensitive)
  - a normal order takes only **plain** FOLDED takas
  - meters use sellable meters as now
- **Linking:**
  - a job work challan can be linked to an order (optional while creating, usually later)
  - on the challan detail: **Link to order / Change order / Unlink** (pick from open orders that have job work required)
  - linking is information only (it doesn't reserve stock), and orders can be switched any time
  - order detail shows its linked job work challans with sent / received / pending
- The availability panel on a job-work order shows the job-worked stock first.

### 2.5 Finished goods withdraw: Others

- Same line entry and auto-picking as 2.2 (quality + colour, takas and/or meters, system picks oldest **plain or job-worked** FOLDED takas; the user chooses which with a toggle on the line, default **plain**), plus a **reason** (required), date and notes.
- Confirm → the takas become `WITHDRAWN`, recorded in a **withdrawal** (`WD-1`, `WD-2`… shared numbering for FG and grey).
- **Cancel withdrawal** (with a confirm) puts every taka back to the exact status it had before, in one transaction, and marks the withdrawal Cancelled. It is never deleted.

### 2.6 Grey withdraw: Direct sell and Others

- **Only grey at our place** (`GODOWN_GREY`) can be withdrawn.
- **Direct sell form:**
  - **Party (weaver)** whose grey is sold: required, one party
  - **Weaver challans:** optional multi-select, limited to that party's challans that still have godown takas
  - **Takas:** the takas of the chosen challans (or of all that party's godown challans when none is chosen), with Select all / First N / tap to pick, and filters by branch and quality; the selection is the quantity, so show takas and meters live
  - **Customer (receiver):** from the Customers master, with a **quick add** (name, phone, city, GSTIN optional) right on the form
  - **Rate per meter:** optional; the amount is calculated when given
  - date (today) and notes
- **Confirm** → one transaction: the takas become `GREY_SOLD`, and a **grey sale** `GS-1`, `GS-2`… is created.
- **Sale challan PDF** via `DocPreview`: customer (+ GSTIN), date, sale no, quality **nickname** (customer-facing document), weaver challan nos, taka list, total takas and meters, and the rate and amount when given.
- Cancelling a grey sale isn't requested. Don't build it; add it to the open questions.
- **Grey Others:** pick takas (filters: branch, quality, party, challan; Select all / First N / tap), with reason (required), date and notes. Creates a withdrawal (`WD-n`) exactly like 2.5, including cancel.

### 2.7 Inventory: new tile, Withdraw button, new toggles

- **New stage tile "FG in job work"** next to the four existing tiles.
  - The detail view shows quality → colour → takas, with job worker, JW challan no, job type and days out.
  - The reconciliation becomes: godown + mill + dyeing + finished + **job work** = all active takas.
- **"Withdraw" button** in the Inventory header opens a clean chooser:
  - **Finished goods** → **Job work** / **Others**
  - **Grey** → **Direct sell** / **Others**

  Each opens its form as a full-screen page (`/inventory/withdraw/fg-job`, `/fg-other`, `/grey-sell`, `/grey-other`).
- **Mode toggles** (next to the existing live / dead / damaged chips):
  - **Sell history:** every **closed order** (status Done) and every **grey sale**, newest first
    - filters: date range, customer, quality, type (Order / Grey sell)
    - totals at the top: entries, takas, meters, amount where known
    - tapping an order opens the existing order detail
    - tapping a grey sale opens a new **grey sale detail** page (`/grey-sales/:id`) with the basic details, the taka list, the PDF button, and a **timeline**: PO (no, date) → weaver challan(s) received (date, branch) → sold (date, customer)
  - **Withdrawals:** every withdrawal (FG Others and Grey Others), with type, date, reason, takas, meters and status (Active / Cancelled)
    - filters: type, date range, status
    - tapping one opens its detail with the taka list and **Cancel withdrawal**

### 2.8 New sidebar module: Job Work

- **Sidebar item "Job Work"** (place it after Folding), route `/job-work`.
- **List:** one card or row per JW challan showing:
  - number, date, job worker, job type
  - linked order
  - status
  - sent takas/m, received takas/m, pending takas/m
  - days out

  Status filter chips (Open / Partly received / Completed / Closed); search by number, job worker, order; the filter modal for job worker and quality. Use the same list pattern as the mill challan list.
- **Add** opens the same job work form as Inventory → Withdraw → Job work.
- **Detail** (`/job-work/:id`):
  - header with status and totals
  - lines (quality nickname + colour) with sent / received / pending and shortage
  - receipts history (date, ref, takas, meters)
  - the taka list (status per taka)
  - buttons: **Receive**, **Close (short)** / **Reopen**, **Link / Change / Unlink order**, **Print / Share challan**

### 2.9 New master: Job workers

- **Masters → Job workers:** name (unique), phone, city, GSTIN (optional; same check and warning as mills/customers), notes.
- Delete is blocked when the job worker is used (existing `USAGE` pattern). Quick add from the job work form.

---

## 3. Data model (additive; suggested names, keep them consistent)

**New tables:**
- **`job_workers`** `(id, name NOT NULL, phone, city, gstin, notes)`
- **`job_work_challans`** `(id, jw_no INTEGER NOT NULL, date, job_worker_id NOT NULL, job_type TEXT, order_id INTEGER, notes, status TEXT DEFAULT 'OPEN', close_reason TEXT, closed_at TEXT, created_at TEXT)`
  - unique index on `jw_no`
  - `status` is one of `OPEN`, `PARTIAL`, `COMPLETED`, `CLOSED`
- **`job_work_takas`** `(id, challan_id NOT NULL, taka_id NOT NULL, quality_id, shade_id, sent_m REAL NOT NULL, received_m REAL, receipt_id INTEGER, status TEXT DEFAULT 'SENT')`
  - indexes on `challan_id` and `taka_id`
  - `status` is one of `SENT`, `RECEIVED`, `NOT_RETURNED`
- **`job_work_receipts`** `(id, challan_id NOT NULL, date, ref_no, notes, created_at)`
- **`withdrawals`** `(id, wd_no INTEGER NOT NULL, kind TEXT NOT NULL, date, reason TEXT NOT NULL, notes, status TEXT DEFAULT 'ACTIVE', cancelled_at TEXT, created_at TEXT)`
  - unique index on `wd_no`
  - `kind` is one of `FG_OTHER`, `GREY_OTHER`
- **`withdrawal_takas`** `(id, withdrawal_id NOT NULL, taka_id NOT NULL, prev_status TEXT NOT NULL, meters REAL)`
- **`grey_sales`** `(id, gs_no INTEGER NOT NULL, date, customer_id NOT NULL, weaver_id NOT NULL, rate REAL, notes, created_at)`
  - unique index on `gs_no`
- **`grey_sale_takas`** `(id, sale_id NOT NULL, taka_id NOT NULL, meters REAL NOT NULL)`

**New nullable columns:**
- **`takas`:**
  - `jw_challan_id INTEGER`: the last job work challan
  - `jw_type TEXT`: set when received back; NULL = plain
  - `jw_return_meter REAL`
  - `grey_sale_id INTEGER`
- **`orders`:** `job_work INTEGER DEFAULT 0`, `job_type TEXT`, `job_notes TEXT`

**Sellable meters** (update the one `SELLABLE` expression and every copy of it): `COALESCE(t.jw_return_meter, t.folded_meter − damaged meters)`. Use it for:
- finished stock
- availability
- order allocation
- dead stock
- the meters sent to job work and withdrawn

**Bump `SCHEMA_VERSION` to 4.** List every table, column and index, with its undo, in `docs/MIGRATIONS.md`.

---

## 4. Tests (`tests/e2e.mjs`, both drivers must pass)

Keep every existing check (rewrite only where a rule changed, and list those). **Add:**

- **Inventory:**
  - inventory detail for each view (incl. dead, damaged, jobwork) loads without throwing
  - the damaged footer total = sum of `damage_m`
- **Job work withdraw:**
  - lines of two qualities × two colours, entered by takas and by meters
  - the system picks the oldest plain FOLDED takas (meters overshoot only on the last taka)
  - not enough stock is rejected; a job-worked taka can't be sent again
  - the challan is `JW-1`; the takas are `JOB_WORK`; the inventory "FG in job work" view and the reconciliation are right
- **Job work receive:**
  - a partial receive with changed meters → takas `FOLDED`, `jw_type` set, sellable = received meters, job work shortage computed
  - status `PARTIAL`, then `COMPLETED` on the last receive
- **Close short / reopen:**
  - remaining takas → `NOT_RETURNED`, reason required, excluded from stock
  - reopen restores `JOB_WORK`
- **Orders:**
  - a job-work order allocates only job-worked takas (type match when given)
  - a normal order allocates only plain ones
  - link / change / unlink a challan to an order
- **FG Others:** withdraw, then cancel; the takas return to their exact previous status; reconciliation holds throughout
- **Grey direct sell:**
  - party + two challans, takas outside those challans rejected, takas of another party rejected
  - quick-added customer
  - rate → amount
  - takas `GREY_SOLD` and gone from grey at our place
  - the grey sale appears in sell history
- **Grey Others:** withdraw + cancel
- **Sell history:**
  - contains closed orders + grey sales only (not withdrawals), with correct totals and filters
  - withdrawals list correct
- **Statuses:** every new transition writes `taka_moves`; an invalid transition is rejected (e.g. job work of a FINISHED taka, a grey sell of a MILL_GREY taka)
- **Batching:** a 300-taka job work send, receive, grey sell and withdrawal each stay within the statement limit

---

## 5. Seed (`src/db/seed.js`)

Extend the demo data (only into an empty **local** database, unchanged rule) so every new screen has something to show:
- 2 job workers
- **JW-1:** partly received, Embroidery, linked to a job-work order
- **JW-2:** completed
- **JW-3:** closed short with 2 not-returned takas
- 1 job-work order and plain orders
- 1 FG Others withdrawal and 1 cancelled grey Others withdrawal
- 2 grey sales (one with a rate)
- at least 2 closed orders

---

## 6. Order of work

1. Backup + baseline (§0).
2. **Bug fix §1** (hooks, error boundary, totals row), and click through all of Inventory.
3. **Data:** schema, statuses, `INACTIVE_STATUSES`, `SELLABLE` update, migrations; all existing tests green in both modes.
4. Job workers master.
5. Job work: repo (withdraw, receive, close/reopen, link order), form, preview, challan PDF, Job Work module (list/detail/receive).
6. How job-worked stock shows: inventory tile + detail, finished cards, availability, orders (switch, allocation, linked challans).
7. FG Others + withdrawals + cancel.
8. Grey direct sell (+ customer quick add, PDF, detail with timeline) and grey Others.
9. Inventory "Withdraw" chooser + Sell history + Withdrawals toggles.
10. Seed + all tests (both drivers), lint, `localtest` build.
11. **Full browser walk-through** in local mode at 1440 px, 820 px and 390 px:
    1. Inventory → Withdraw → FG job work (2 qualities, 3 colours) → preview → confirm → JW PDF
    2. Job Work module → receive partly with changed meters → receive the rest → completed
    3. A second challan → close short → reopen → close again
    4. Link to an order, then switch the order
    5. Inventory finished cards show plain vs job-worked
    6. A job-work order auto-allocates only job-worked takas
    7. FG Others → cancel
    8. Grey direct sell with quick-add customer + PDF
    9. Sell history → grey sale detail timeline
    10. Withdrawals list
    11. Every Inventory tile and toggle: no white screen, no console errors
12. **Docs** (§7).

---

## 7. Docs

- **`docs/SPEC.md`:**
  - new rules **R-JW-1..n** (job work), **R-WD-1..n** (withdrawals), **R-GS-1..n** (grey sell), **R-SO-3** (job-work orders, allocation plain vs job-worked), **R-INV** (job work view, sell history, withdrawals)
  - the new statuses and transitions in the state machine section
  - **decisions:** the system picks takas for FG withdrawals; job-worked stock is kept separate; linking is information only
  - **open questions:**
    - cancelling a grey sale
    - editing a JW challan after sending
    - job work rates
    - whether a job-worked taka can go for a second job work
- **`docs/AUDIT.md`:** a section "Client changes 2" with one traceability row per item, including the white-screen fix and its cause.
- **`docs/MIGRATIONS.md`:** every new table, column and index, with its undo; `schema_version` 4.
- **`docs/tasks/`:** add `11-job-work.md`, `12-withdrawals.md` and `13-grey-sell-and-sell-history.md`; update `09-inventory.md` and `10-availability.md`.
- **`docs/PROGRESS.md`:** a Session 4 log covering:
  - backup location
  - baseline and final test results (both drivers)
  - rewritten tests
  - widths checked
  - anything not verified and why
- **`README.md`:** mention the new modules. Deploy steps are unchanged (the app upgrades Turso automatically on first open; take a Turso snapshot first).

---

## 8. Final report

Send a short summary covering:
- what was built, per section
- the white-screen cause and fix, and every other page where you found the same hook problem
- test results (both drivers), lint and build
- widths checked
- anything not done or not verified, and why
- the open questions
