# Vinee Creation: client changes, round 4 (sell to order, stock on order detail, full-width desktop, folding "In mill", 3-step mill receipt)

You are working on **Vinee Creation**, a textile trading ERP:

- **Stack:** React 19 + Vite + Tailwind, JavaScript, client-only.
- **Data layer:** all data access and every business rule live in `src/db/repo.js`, running on sql.js (local) or Turso (browser-direct) through `src/db/client.js`.
- **Docs:** the authority is `docs/` (SPEC, AUDIT, PROGRESS, MIGRATIONS, tasks/). `AGENTS.md` is the entry point.

**Rounds 1–3 are done.** Their rules stay in force:

- colour library + quality colours
- main/sub mill challans
- shortage chain grey → finished → folded
- damage and sellable meters
- job work, withdrawals, grey sell, sell history
- programs against weaver challans
- lot numbers per program line (locked after the first receipt)
- `TakaChip` / `TakaList` display
- tablet-first layout rules (SPEC R-UI-1/2)
- batched writes (≤ about 20 statements per big save)
- the error boundary
- `npm test` + `npm run test:libsql`

**Before planning, read the current code of these screens:** the program receive screen, the program builder, the order detail, the availability panel, the withdraw chooser, the folding page and the page layout components. Build on them; don't rewrite them.

**Read this whole document and `docs/SPEC.md` before touching any code.**

---

## 0. Safety rules (these win over everything else)

1. **Never touch the real database.**
   - `.env.local` points to the client's Turso database.
   - `.env.development.local` and `.env.localtest.local` (git-ignored, empty Turso values) keep `npm run dev` and `--mode localtest` in **local mode**. Check that both exist and that Settings shows **LOCAL**.
   - Never run plain `npm run build` / `npm run preview`.
   - Never print, copy or commit secrets from `.env.local`, `env 1.download` or `test-db.js`.
2. **Git: the owner commits, not you.**
   - Don't commit, branch or push.
   - First, back up `src/`, `tests/`, `docs/`, `package.json` and `package-lock.json` to `../vinee-backup-<YYYY-MM-DD-HHmm>/`, and note the location in `docs/PROGRESS.md`.
   - Never discard uncommitted work.
3. **Database changes are additive and idempotent only.**
   - This round probably needs **no schema change**. If one turns out to be needed:
     - add only (tables, nullable columns, indexes)
     - bump `SCHEMA_VERSION`
     - make it safe for the client's Turso database at its next open
     - document it in `docs/MIGRATIONS.md` with the undo
4. **Baseline first.**
   - Run `npm install`, `npm test`, `npm run test:libsql`, `npm run lint` and `npx vite build --mode localtest`.
   - Record the results under "Session 6 (client changes 4)" in `docs/PROGRESS.md`.
   - All passing tests must still pass at the end.
   - Rewritten tests (rule changes only) must be listed.
5. **Change carefully.**
   - No unrelated refactors.
   - No new dependencies in `package.json`. Playwright via `npx` is allowed for the viewport check, as in round 3.
   - Before changing shared code (layout components, `ui.jsx`, `kit.jsx`, `repo.js` helpers), find every place that uses it and re-check them all.
   - Existing URLs keep working.
6. **Rules in `repo.js`:**
   - one transaction with status checks
   - `taka_moves` for every status change
   - batched statements
7. **After each step:** both test modes, lint, the `localtest` build, and the affected screens opened in local mode with no console errors. If something breaks, fix it or restore from your backup.
8. **When unsure about something hard to undo, stop and ask.** Otherwise choose the simplest safe option and record it under "Decisions" in `docs/SPEC.md`.

---

## 1. Inventory → Withdraw → **Sell to order**

**Rule:** finished goods can be given to an open **customer order (SO)** straight from Inventory. This is the same business action as **Auto-allocate** on the order (folded takas → `SOLD` with `order_id`). It must reuse that logic, not copy it.

1. **Chooser:** add a third option under **Finished goods** in the Withdraw chooser: **Job work / Others / Sell to order**. Route: `/inventory/withdraw/fg-order`.
2. **Pick the order:**
   - searchable list of **open orders**: order no, date, customer, quality nickname, job-work chip, pending takas/meters
   - filters: customer, quality
   - Support `?order=<id>` to open it preselected (used by the order detail button in §2).
3. **Order lines:** one card per line (colour swatch/image + shade name), showing:
   - ordered takas/meters
   - already given
   - pending
   - available stock that the line may use:
     - **plain** folded stock for a normal order
     - **job-worked** stock (matching the job type when the order names one) for a job-work order
4. **What the system suggests:**
   - The pending takas and/or meters come prefilled; the user can change both numbers or set a line to 0.
   - The system picks the oldest eligible takas, using the same rule as Auto-allocate: whole takas, the last one may overshoot the meters, sellable meters.
   - A collapsible **preview** per line shows the picked takas (`TakaList` style, meters prominent, lot shown).
   - Not enough stock → a clear message on that line. The user can still confirm with what is available, and that line stays pending.
5. **Confirm:**
   - A modal shows per line the takas and meters to give, then the grand total.
   - Confirm runs **one transaction**: takas → `SOLD`, `order_id` set, `taka_moves` (ref `ORDER`).
   - The order closes (Done) when every line is covered, exactly as now, so it appears in **Sell history**.
6. **After saving:** a success screen with the summary and buttons **Open order** (→ `/orders/:id`) and **Back to inventory**.
7. **Repo:** refactor `allocateOrder` into a shared core.
   - **`previewOrderAllocation(orderId, wants)`:** `wants` = `[{ order_line_id, takas?, meters? }]`; returns the picked takas per line, read-only.
   - **`allocateOrderLines(orderId, wants)`:** the transaction.
   - `allocateOrder(id)` (the Auto-allocate button) calls the core with the full pending amounts. Its behaviour and its existing tests must not change.

---

## 2. Order detail: show the available stock

On `/orders/:id`, add an **"Available stock"** section (the existing availability panel, adapted). For each order line (quality + colour), show:

- **Ready (folded):**
  - **plain** and **job-worked** separately (job type chips)
  - the eligible one for this order highlighted
- **Finished, still to fold**
- **In dyeing:** with program no, mill and lot nos
- **At job worker:** with JW challan no

Show these **once for the quality**:

- grey at mill (by mill)
- grey at our place (by branch)
- open POs: count + pending meters

Each line also shows **"Short by X takas / Y m"** or **"Covered"**, based on the eligible ready stock against the pending quantity.

**Buttons:**
- **Allocate now:** opens §1 with this order preselected (`/inventory/withdraw/fg-order?order=<id>`).
- Keep the existing **Auto-allocate**.

On tablet the section sits below the order lines; on desktop (≥ 1280 px) it goes in a right column.

---

## 3. Full-width screens on desktop and laptop (all screens)

**Problem:** on desktop, create, list and detail screens sit in a narrow centred column (e.g. `max-w-5xl` / `max-w-6xl`), leaving wide empty margins. The client wants the space used.

**Rules** (apply them to **every** page and drawer: PO, grey challan, mill challan, program builder/detail/receive, folding, job work, withdraw forms, orders, inventory, availability, reports, masters, dashboard):

1. **Width:**
   - At **≥ 1280 px**, remove the narrow page caps. Use the full content width with the normal page padding.
   - Cap only at about **1800 px** (`max-w-[1800px]`, centred), so very large monitors stay readable.
   - Below 1280 px nothing changes. The tablet layouts from round 3 stay exactly as they are.
2. **Forms:**
   - 3 fields per row at `xl` and 4 at `2xl`, instead of 2.
   - Long text fields (notes, address) span 2 columns.
   - Group headings stay.
3. **Form + summary pages:** the main area takes the rest of the width; the summary column is a fixed **320–360 px** on the right, sticky.
4. **Taka grids** (`TakaChip`): more columns at wide widths (e.g. 8 at `xl`, 10 at `2xl`); tiles keep the same size, they don't stretch.
5. **Lists:** tables use the width for more useful columns where data exists (e.g. party, quality, totals). Card lists become 3–4 cards per row at `xl` / `2xl`.
6. **Detail pages:** two columns at `xl`: main content left, a key-facts/actions side panel right.
7. **Do it centrally:** make it a layout helper (e.g. a `PageWidth` / `PageGrid` component or shared classes) instead of editing magic classes page by page. Check the `Drawer` full-screen pages too.
8. **Check:** the viewport screenshots (§6) at 1280×800, 1440×900, 1920×1080 must show no big empty side gutters and no stretched or awkward controls (e.g. a single input 1500 px wide). Fix such cases with sensible max widths inside the grid.

---

## 4. Folding → **In mill**

1. **"In mill" button** in the Folding page header. It opens a view (`/folding/in-mill`) listing every program with takas still in dyeing (not received), **grouped by mill**. Each program card shows:
   - program no, date
   - qualities (nicknames)
   - colour chips
   - issued / received / pending takas and meters
   - days since issue

   Add search (program no, quality, weaver challan, lot) and a mill filter.
2. **Tapping a program** opens **Receive from mill** for it in a **restricted mode** (`/folding/in-mill/:programId/receive`, or the receive route with `?from=folding`):
   - shows only the receive steps (§5)
   - hides program actions: Add more takas, edit, print, links to the program builder
   - Back and save return to **Folding → In mill**
   - after a save, a short success message offers **Fold these takas now**, which opens Folding filtered to that mill return challan
3. **This is not security.** The app has **no logins yet**; this is a simplified mode for the folding person. Record it in SPEC (decision), and keep "roles/login" in the open questions.

---

## 5. New receive-from-mill flow (3 steps + confirm)

Replace the round 3 receive UI (where lot and finished meters were entered together) with a cleaner flow. **The repo rules don't change:**
- lot per program line, locked after the first receipt
- finished meters required (> 0, ≤ 2 decimals)
- one transaction
- `createFinishedReceipt({ program_id, challan_no, date, notes, image_url, lines: [...] })`

**Step 1: Mill challan**
- mill return challan no (required), date (today), notes, optional photo
- **Next**

**Step 2: Select takas and lot numbers** (no meters here)
- Weaver-challan cards (collapsible, as in round 3): pick a weaver challan of this program that has pending takas.
- Inside, pending takas are **grouped by shade**. Each shade group has:
  - swatch + shade name
  - **Lot no** input (prefilled and **locked** with a lock icon if the line already has a lot)
  - a `TakaChip` tap grid with Select all / First N / Clear
  - live selected takas · grey meters
- A shade group with selected takas but no lot shows an inline error and blocks Next.
- **Done** collapses the card into one line, e.g. `WC-55 · Gold Lava · 37: 10 takas, lot L-778 · 39: 6 takas, lot L-779`.
- **+ Add another weaver challan** opens another card.
- **Next** (enabled when at least one taka is selected and every group with a selection has a lot).

**Step 3: Finished meters, lot by lot**
- **One collapsible card per lot no.** If the same lot text was given to several lines (challans or shades), they show in **one lot card** with small sub-headers (`WC-55 · ● 37`).
- **Only one lot card is open at a time;** the others collapse to a summary line:

  `L-778 · 16 takas · grey 1,602.40 m · finished 1,560.10 m · shortage 42.30 m (2.64%) · ✓ complete`

  or `· 5 meters missing`.
- **Inside an open lot card:** a clean list (one row per taka) showing:
  - taka no (muted)
  - grey m
  - **finished m input** (large, `inputMode="decimal"`)
  - live shortage per row
- **Entry helpers:**
  - **Enter moves to the next input**; after the last one, it opens the next lot card and focuses its first input
  - a **Paste** button per lot (one value per line, filled in row order) with a clear message if the count doesn't match
- Inputs are validated as typed (≤ 2 decimals, > 0, an amber warning if finished > grey).
- Lot totals sit at the bottom of the card.
- **Next** is enabled only when **every** selected taka has a valid finished meter.

**Confirm** (modal):
- per lot → line: takas, grey, finished, shortage
- the grand total
- **Confirm & receive** (one transaction)

**Back buttons** keep all entered data between steps. Leaving the page with unsaved entries asks for confirmation.

**Layout:**
- **Tablet:** a sticky bottom bar with the step totals and the Next / Confirm button.
- **Desktop:** a right summary column (§3).

**The same screen serves both entry points:** the program detail **Receive from mill** button (full mode) and Folding → In mill (restricted mode, §4).

---

## 6. Tests and checks

**`tests/e2e.mjs`, both drivers.** Add checks for:
- **`previewOrderAllocation`:**
  - plain-only for normal orders, job-worked-only (type match) for job-work orders
  - oldest first; partial quantities
- **`allocateOrderLines`:**
  - changed quantities and a line set to 0
  - not enough stock leaves the line pending
  - the order closes only when all lines are covered
  - `SOLD` + `order_id` + `taka_moves`
  - a failed save leaves no changes
- **`allocateOrder` (Auto-allocate):** gives exactly the same result as before (regression)
- **Order detail availability data:** per line ready plain / job-worked / to fold / dyeing (with lots) / at job worker; quality-level grey and open POs; the "short by / covered" figures
- **In mill list:** only programs with takas in dyeing, grouped by mill, with correct pending counts
- **Receipt through the new flow's payload:**
  - two lines sharing one lot text
  - a locked lot honoured
  - missing meters rejected
  - one transaction
- **Reconciliation:** inventory still reconciles

**Viewport check** (Playwright via `npx`, against the `localtest` preview):
- **Sizes:** 768×1024, 1024×768, 820×1180, 1180×820, 1280×800, 1440×900, 1920×1080, and 390×844 (phone sanity).
- **Routes:** every route changed this round (withdraw chooser + sell to order, order detail, folding, in mill, receive steps 1–3, plus at least one create, list and detail page per module for the full-width change).
- **Assert** `scrollWidth <= innerWidth`.
- **Save screenshots** to `docs/screens/round4/<route>-<w>x<h>.png`.
- **Look at them** and fix crowded or empty layouts.
- If Playwright can't run, say so plainly in the report. Don't claim it was checked.

---

## 7. Seed

Extend `src/db/seed.js` (only into an empty **local** database):
- an open normal order and an open job-work order, both with matching ready stock (so Sell to order and the order-detail stock have data)
- at least two programs with takas still in the mill (so "In mill" shows them), one with a lot already set on a line

---

## 8. Order of work

1. Backup + baseline.
2. Repo: the allocation core (`previewOrderAllocation`, `allocateOrderLines`, `allocateOrder` on top) + tests.
3. Sell to order (chooser option, form, preview, confirm, success screen).
4. Order detail available stock + the Allocate now link.
5. New receive flow (3 steps + confirm), wired to the program detail.
6. Folding → In mill + restricted receive mode.
7. Full-width layout helper, applied to all screens.
8. Seed, tests (both drivers), lint, `localtest` build.
9. Viewport screenshots + fixes.
10. Full browser walk-through:
    1. order detail → Allocate now → partial give → order stays open
    2. Sell to order the rest → order Done → Sell history
    3. Folding → In mill → receive (lots, two lines sharing a lot, a locked lot) → Fold these takas now
    4. program detail receive (full mode)
    5. desktop check of every module at 1440 and 1920
11. Docs.

---

## 9. Docs

- **`docs/SPEC.md`:**
  - **R-SO-4:** sell to order from inventory, same rule as Auto-allocate
  - **R-SO-5:** available stock on order detail
  - **R-FR:** update for the 3-step receive
  - **R-FD-5:** folding In mill + restricted mode (not security)
  - **R-UI-3:** full-width desktop rules
  - **Decisions:** the shared allocation core; lot cards merge lines with the same lot text
  - **Open questions:** roles/login (who may receive from the mill), and whether meters may ever be entered later
- **`docs/AUDIT.md`:** a section "Client changes 4" with traceability rows.
- **`docs/tasks/`:** update `06-program.md`, `07-mill-receipt-folding.md`, `09-inventory.md`, `10-availability.md`, and the orders task.
- **`docs/PROGRESS.md`:** a Session 6 log with the backup, baseline, final results, viewport results, and anything not verified.
- **`docs/MIGRATIONS.md`:** only if a schema change was made.

---

## 10. Final report

A short summary covering:
- what was built
- how Auto-allocate and Sell to order now share one core
- test results (both drivers), lint, build
- the viewport results per width (pass / fixed)
- anything not done or not verified, and why
- the open questions
