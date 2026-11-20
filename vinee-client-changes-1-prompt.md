# Vinee Creation: client changes, round 1 (one prompt, all changes)

You are working on **Vinee Creation**, a textile trading ERP:

- **Flow:** grey PO → weaver (grey) challan → mill challan → dyeing program → mill receipt → folding → customer orders.
- **Stack:** React 19 + Vite + Tailwind (JavaScript), client-only.
- **Data layer:** all data access and every business rule live in `src/db/repo.js`, which runs on sql.js (local) or Turso (remote) through `src/db/client.js`.
- **Project docs:** the authority is `docs/` (SPEC, AUDIT, PROGRESS, tasks/, MIGRATIONS). `AGENTS.md` is the entry point. An audit was already done (see `docs/AUDIT.md`), and `npm test` runs a full end-to-end scenario on a fresh in-memory database.

The client asked for **7 changes** (§3). Implement **all of them in this one session**, together with the supporting fixes in §2. Go in the order of §5.

**Read this whole document before touching any code.**

---

## 0. Safety rules (these win over everything else)

### A. Never touch the real database

1. `.env.local` contains `VITE_TURSO_DATABASE_URL` / `VITE_TURSO_AUTH_TOKEN`, so a normal `npm run dev`, `npm run build` or `npm run preview` **talks to the client's Turso database**. You must not do that.
2. **First action, before running anything:** create `.env.development.local` with these two lines, both empty:

   ```
   VITE_TURSO_DATABASE_URL=
   VITE_TURSO_AUTH_TOKEN=
   ```

   Vite gives `.env.[mode].local` priority over `.env.local`, so `npm run dev` now runs in **local mode** (browser IndexedDB). Confirm it: Settings must show **LOCAL**.
3. For a production-like local check, use `npx vite build --mode localtest` with a `.env.localtest.local` holding the same two empty lines, then `npx vite preview --mode localtest`.
   - **Never** run plain `npm run build` / `npm run preview`.
   - Both new files are git-ignored by `*.local`. Check that they are.
4. `tests/` already refuses remote databases. Keep it that way.
5. Never print, log, copy or commit the values in `.env.local`, `env 1.download` or `test-db.js`. Don't edit or delete those files.
6. **All migrations are additive:** new tables, new nullable columns, new indexes, and inserts of new link rows.
   - No dropping, renaming or retyping. No deleting or updating existing business rows (except filling a new column).
   - Every migration must be **idempotent**: it will run automatically on the client's Turso database the next time the app opens there, and that database already holds some test data. Write each undo step in `docs/MIGRATIONS.md`.

### B. Record what works first

7. Create branch `client-changes-1` from the current `HEAD`. One commit per numbered step in §5. Never push. Never add a remote.
8. Run `npm install`, `npm test`, `npm run lint` and `npx vite build --mode localtest`. Record the results in `docs/PROGRESS.md` under a new "Session 3 (client changes 1)" heading. Every test that passes now must still pass at the end, **except** the checks this prompt deliberately changes, which are:
   - rack assignment and history
   - the rack picking list
   - item codes / `generateItems`
   - programs requiring a shade chart
   - the "direct taka starts at mill grey" check
   - the weaver-loss checks

   Rewrite each of those to the new rule; don't just delete them. List every rewritten check in PROGRESS.md.

### C. Change carefully

9. Touch only the files a step needs. No unrelated refactors, renames, reformatting or file moves.
10. No dependency upgrades and no new frameworks. You may use browser APIs (MediaRecorder, `<input type="file" capture>`) and the libraries already in `package.json`. If you truly need a new package, stop and ask.
11. Before changing shared code (`components/ui.jsx`, `components/kit.jsx`, `DocPreview.jsx`, `repo.js` helpers, `client.js`), find every place that uses it and re-check those places afterwards.
12. Keep existing URLs working. Where a page goes away, redirect its route to the nearest new page.
13. Keep the current look: maroon theme, existing components, same spacing and typography. New screens must look like they always belonged. Everything must work on **tablet and desktop** (and not break on phone), with no sideways scrolling of the page.

### D. Check after every step

14. After each step:
    - run `npm test`, `npm run lint` and the `localtest` build
    - open the affected screens in the browser (local mode), with no console errors
    - re-check the earlier steps that could be affected

    If something that worked is now broken, fix it or revert that step. Never leave the app broken between commits.

### E. When unsure

15. If a decision isn't settled here and is hard to undo, stop and ask. If it's easy to change later, choose the simplest safe option, note it under "Decisions" in `docs/SPEC.md` and carry on.

---

## 1. Decisions already taken by the client

- **Turso access stays as it is:** the browser talks to Turso directly with the token in the build. The client accepts this for now. Don't add a server or a login. Record it as a known risk in `docs/AUDIT.md`.
- **Testing is on local copies only.** Never connect to the client's Turso database.
- **Turso data is left as it is.** No wipe, no demo seed into it.
- **Images go to Cloudinary** via the existing `src/lib/cloudinary.js` (unsigned upload; env `VITE_CLOUDINARY_CLOUD_NAME` + `VITE_CLOUDINARY_UPLOAD_PRESET`).
  - **Never** put a Cloudinary API key or secret anywhere in the code, env files or docs. A browser app must not hold them.
  - When Cloudinary isn't configured, the existing compressed-data-URL fallback stays (fine for local testing).
- **Voice notes** (folding damage): see change 6.
- **The `rivoora-ref/` folder stays where it is.** Don't touch it, don't read it, and don't copy anything from it. It's a different project.

---

## 2. Supporting fixes (do these as part of the work)

### F-1. Make Turso work smoothly

The client will start entering real data on Turso after this release.

1. **Fast start-up.** Today `db()` runs about 40 schema statements one by one on every page load. Over HTTP to Turso that's many round trips.
   - Add a `schema_version` key in the `settings` table.
   - When the stored version equals the current code's version, skip `SCHEMA`/`COLUMNS`/`MIGRATIONS`.
   - Otherwise run them, preferring one `batch` call on Turso, then store the new version.
   - Keep everything idempotent. (The `settings` table must exist first, so create it with `IF NOT EXISTS` before reading the version.)
2. **Few round trips inside transactions.** Several writes run one statement per taka inside an interactive transaction, e.g. `createFinishedReceipt`, `foldTakas`, `updateReceipt`. On Turso, saving 300–500 takas would be very slow and can hit the interactive-transaction timeout.
   - Rewrite them to multi-row statements, e.g. `UPDATE … SET finished_meter = CASE id WHEN ? THEN ? … END WHERE id IN (…) AND status=?`, in chunks of about 100–200 rows, checking `changes` as now.
   - The same logic and the same state checks must stay.
   - **Target:** any save of 500 takas uses at most about 20 statements.
   - Apply the same rule to all new code in this prompt.
3. **Test the Turso code path locally** without any remote database. In `tests/harness.mjs`, add a second mode (`VINEE_TEST_DRIVER=libsql`):
   - alias `@libsql/client/web` to `@libsql/client`
   - point it at a temporary `file:` database
   - run the full `tests/e2e.mjs` through `makeTurso()`

   Add `npm run test:libsql`. Both test modes must pass. (`@libsql/client` is already a dependency.)
4. **Clear errors.** If a Turso call fails (network, auth), the screen shows a readable message ("Could not reach the database — check the internet connection and try again"), not a blank page. Saving never half-completes, because transactions roll back.

### F-2. Remove the local "auto-repair" wipe

In `seedIfEmpty()`, local mode currently **deletes all data** if it finds duplicate PO numbers or quality nicknames. Remove that branch completely:
- never wipe data automatically
- if duplicates exist, just `console.warn` them

### F-3. Doc paths

`AGENTS.md` points to `specs/PROGRESS.md` and `src/layout/AppShell.jsx`, which are wrong. Fix them to `docs/PROGRESS.md` and `src/components/AppShell.jsx`.

---

## 3. The client's changes

### Change 1: pending POs in the order availability panel

- In the availability panel (`src/pages/orders/AvailabilityPanel.jsx`, used on **Create/Edit Order** and on the **Availability** page), add one small block for the selected quality:
  - **"Open POs: N · Pending: X m"**
  - N = POs of that quality with status **Open** or **Partly received** (not *Received*, not *Closed (short)*)
  - X = the sum of their pending meters (`pending_m` from `decoratePo`)
- Extend `availabilityDetail()` (add a field; keep the existing fields).
- Tapping the block may link to the PO list filtered by that quality, if that filter exists. Otherwise no link.
- **Show only the count and total pending meters.** No per-PO list.

### Change 2: GST number in mill and customer masters

- Add a nullable `gstin` column to `mills` and to `customers` (`COLUMNS` in `schema.js`; add it to `MASTER_COLS`).
- Both are **optional**. The value is trimmed and saved in capitals.
- If filled and it doesn't match `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`, show an **amber inline warning** ("This doesn't look like a valid 15-character GSTIN"), but still allow saving.
- Show GSTIN in the mill and customer lists (hide the column on narrow screens if needed).
- Print the mill's GSTIN on the mill challan PDF under the mill name, when present.

### Change 3: no item master; colours belong to qualities

**The client's words:** there is no separate item master and no item codes any more. Each quality has its own colours. The same colour can be used by several qualities, so the **Shade master is a common colour library**. A colour is defined by a **colour picker and/or an image** (camera or attachment), because some shades can't be made in a colour picker. A quality can also have a colour of **its own**, uploaded directly on the quality, which does **not** go into the common library. A colour can be marked **inactive** for a quality. For each quality colour, show **how long ago it was last used**.

**Data model (additive, keeps every existing join on `shade_id` working):**

- **`shades` stays the colour table.** New nullable columns:
  - `image_url TEXT`
  - `quality_id INTEGER`: NULL = common library colour; set = private colour of that one quality, never shown in the library
  - `active INTEGER DEFAULT 1`: library-level active
- **Identifier and colour:**
  - The **name** is the colour's identifier. The UI label is **"Shade name"**, stored in the existing `number` column (required).
  - The existing `name` column becomes optional **"Description"**.
  - Uniqueness (case-insensitive): unique within the library for library colours, unique within the quality for private colours.
  - At least one of `hex` or `image_url` is required. `hex` stays optional when an image is given, so drop the hard hex requirement in `REQUIRED`/validation and keep the hex format check when it is filled.
- **Shade charts go away from the UI.** The schema still has `shades.chart_id NOT NULL` and `programs.chart_id NOT NULL`, so:
  - the migration creates one hidden chart named `__library__` (only if missing)
  - every new shade and every new program uses its id
  - existing charts and shades are kept, and existing shades remain library colours
- **New table `quality_shades`:** `(id, quality_id NOT NULL, shade_id NOT NULL, active INTEGER DEFAULT 1, added_at TEXT)`, plus a unique index on `(quality_id, shade_id)`. One row = this colour is available for this quality. Private colours also get a row.
- **Migration for existing data:** insert `quality_shades` rows (if missing) for every `(quality_id, shade_id)` found in:
  - `items` that have a shade
  - `programs` × `program_lines`
  - `orders` × `order_lines`

  Nothing else changes, and existing `items` rows and `item_id` columns stay but are no longer used.

**Rules (enforce in `repo.js`, not only in the UI):**
- A program line and an order line must use a colour that is linked **and active** for that program's or order's quality. An inactive colour stays visible in old programs and orders.
- A colour linked to a quality can be **removed** from it only if it was never used for that quality (no program line, no order line). Otherwise it can only be made inactive.
- A library colour can't be deleted while any quality, program or order uses it. Use the existing `USAGE` pattern and add `quality_shades`.
- **Last used:** for each quality colour, compute:
  - **last program date**: max `programs.date` with that quality + shade
  - **last order date**: max `orders.date` with that quality + shade

  Show them as relative text, e.g. **"Last program 12 days ago · Last order 3 days ago"**, "today", "yesterday", or **"Never used"**. Put the relative-date helper in `src/lib/format.js`.

**Screens:**
- **Masters → Shades (common library):**
  - a clean grid of colour cards, each with the swatch (or image thumbnail), shade name, description and "Used by N qualities"
  - search by name
  - Add / Edit opens a modal with: shade name, description, a **colour picker** (`<input type="color">` + hex text box), and **image**, offering both **Camera** (`accept="image/*" capture="environment"`) and **Upload** (`accept="image/*"`), using `uploadImage()` with a preview and a remove option
  - no shade-chart headings or buttons any more
- **Masters → Qualities:** each quality gets a **Colours** view (a drawer or full-screen panel). It shows:
  - the quality's colours as cards: swatch or image, name, a "Private" badge for quality-only colours, an **Active toggle**, the last-used text, and remove (only when never used)
  - **"Add from library"**: a searchable multi-select of library colours not yet linked
  - **"Add own colour"**: name, optional picker colour, image (camera/upload); creates a private shade plus its link
  - inactive colours shown greyed at the end
- **Masters → Items:**
  - remove the tab and its "generate" panel
  - redirect `/masters/items` to `/masters/qualities`
  - leave `listItems` / `generateItems` / `suggestItemCode` in `repo.js` unused, with a short comment saying why
- **Masters → Shade charts:** remove the chart UI from the Shades tab.
- **Create program:**
  - remove the Shade chart field
  - lines pick **colours of the chosen quality (active only)**, shown with swatch or image and name; the same colour can't be used twice
  - `createProgram` drops the "shade must belong to the chosen chart" check, adds the "linked and active for this quality" check, and stores the hidden library chart id
  - everything else stays as it is: FIFO from grey at that mill, totals, the split must add up
- **Program detail and program PDF:**
  - replace item code with **swatch-or-image + shade name**
  - the PDF must show the image when a colour has one; make sure `html2canvas` captures Cloudinary images (CORS / `useCORS` is already on, so check it really works with a remote image)
  - remove "Shade chart" from the header
- **Create/Edit order, order detail, order list:** lines pick from the quality's active colours (swatch/image + name). Replace the item code everywhere with the shade name. `cleanOrderLines` uses `shade_id` directly; `item_id` becomes optional and unused.
- **Availability page:** choose the quality first, then its colours (no item codes).
- **Everywhere item codes are shown** (folding, inventory, inventory detail, receive program, ProgramList swatches), show the shade name with the swatch or image instead.
- **Reusable piece:** add one `ShadeSwatch` component (image if present, else hex, else a neutral placeholder) in `components/kit.jsx` and use it everywhere a colour is shown.

### Change 4: no racks; the mill challan is made against weaver challans (main + sub-challans)

#### 4a. Remove racks

- **Keep branches** (which godown the grey was received at). Remove shops/racks from the whole user flow:
  - the **Rack/Godown** page and its sidebar item (redirect `/assignment` to `/inventory`)
  - the rack field on the grey challan form and its confirm popup
  - the "Without rack" figures and rack columns on the receipt detail, dispatch screens, inventory and inventory detail
  - the rack filter
  - the **picking list** (the screen block, the preview tab, the print button)
  - the Masters → Racks (`locations`) tab
- "Grey at our place" in inventory and availability is now grouped **by branch** only.
- **Data stays:**
  - `locations`, `takas.location_id` and the existing `taka_moves` history are not deleted
  - `createReceipt` ignores `location_id`
  - `assignLocation` / `getPickList` / `groupPickList` stay in `repo.js` unused (comment why)
  - new takas get `location_id = NULL`
- Remove the rack-related branch check from receipt editing only where it no longer applies. Keep the branch logic.

#### 4b. New mill challan flow

**Business rule (client):**
- A mill challan is **always issued against a weaver (grey) challan**.
- The user selects the weaver challan number; the **party is auto-filled** from it, and only the takas of **that** challan can be selected (partly, e.g. 36 of 48).
- Several weaver challans go to the mill together, so the system groups them as **one main mill challan** with **one sub-challan per weaver challan**:
  - main **121**
  - sub-challans **121A, 121B, 121C…**
- Today they print one challan per weaver challan and staple them together. Our system replaces that.

**Data model (additive):**
- **New table `mill_challan_mains`:**
  - `(id, main_no INTEGER NOT NULL, date TEXT, mill_id INTEGER NOT NULL, notes TEXT, status TEXT DEFAULT 'OPEN', created_at TEXT)`
  - unique index on `main_no`
- **New nullable columns on `mill_dispatches`** (each existing row = one sub-challan):
  - `main_id INTEGER`
  - `receipt_id INTEGER`: the weaver challan
  - `suffix TEXT`: A, B, … Z, then AA, AB, …
- **Numbering:**
  - `dispatch_no` of a sub = `${main_no}${suffix}`, e.g. `121A`
  - `main_no` = `MAX(main_no)+1`, **starting at 1**, decided inside the save transaction
  - the user may type a different free number (it must be unique)
- **Old challans** (rows without `main_id`, e.g. local demo data) stay readable as **"Old challan DC-0001"**, shown in the list as a single challan with no sub-challans. They are not rewritten.

**Rules (in `repo.js`, one transaction each):**
- `createMillChallan({ main_no?, mill_id, date, notes, parts: [{ receipt_id, taka_ids }] })`:
  - creates the main and one sub per part, with letters in the order given
  - each part's takas must all belong to that `receipt_id` and be `GODOWN_GREY`
  - the same `receipt_id` can't appear twice in one save
  - at least one part, and every part must have at least one taka
  - takas move to `MILL_GREY` with `mill_id`, `dispatch_id` = the sub, `location_id = NULL`, and a `taka_moves` row (`ref_type 'DISPATCH'`) exactly as today
- `addToMillChallan(main_id, parts)`:
  - only while the main is `OPEN`
  - same checks as above
  - new letters continue after the last one
  - if a part's weaver challan already has a sub in this main, its takas are **added to that existing sub** (same letter), not a new letter
- `closeMillChallan(main_id)` / `reopenMillChallan(main_id)`: closed = no more additions. Reopening is allowed (reversible).
- Direct-to-mill receipts never appear here (they are already grey at the mill).
- A weaver challan whose godown takas were all sent no longer appears in the picker.
- The list of weaver challans to pick from = receipts with destination GODOWN that still have `GODOWN_GREY` takas, optionally filtered by branch and quality. Each entry shows challan no · party · quality nickname · takas still in godown.

**Screens (clean and simple, tablet and desktop):**
- **Mill challan list** (`/dispatch`): one card or row per **main** challan showing:
  - main no
  - date
  - mill
  - status (Open / Closed)
  - number of sub-challans
  - total takas and meters
  - qualities (nicknames)

  Expanding a row shows its sub-challans (121A · weaver challan · party · quality · takas · meters). Keep the existing search and filter modal, adapted.
- **New mill challan** (`/dispatch/new`), one screen:
  - **Header:** mill (required), date, main no (auto, editable), notes
  - **"Weaver challans" area:** a vertical stack of part cards
    - The **active card** is expanded:
      - weaver challan picker, searchable, with optional branch and quality filters
      - **party** shown read-only (auto-filled)
      - quality nickname shown
      - the challan's takas still in godown as a compact selectable grid or table (taka no, meters), with **Select all**, **First N**, **Clear**, and a running count and meters
    - When the user taps **"Done"** or **"+ Add another weaver challan"**, the card **collapses** to one clean line, e.g. `121B · WC-55 · Ganesh Fabrics · Gold Lava · 24 takas · 2,400.50 m`, with **Edit** (re-expands it) and **Remove**.
    - Letters (A, B, C…) update live as parts are added or removed.
  - **Summary:**
    - **desktop:** a right-hand column
    - **tablet/phone:** a sticky bottom bar
    - shows parts, total takas, total meters and the Save button
  - **Save** opens a confirm popup listing every sub-challan with its counts, then saves everything in **one transaction**.
  - Use the existing two-step pattern on tablet only if it stays clean. A single scrolling page with collapsible cards is preferred.
- **Main challan detail** (`/dispatch/:id`, where `:id` is the main):
  - header with main no, mill + GSTIN, date, status, totals
  - sub-challans as collapsible sections with their taka lists
  - buttons: **Print / Share full challan**, **Print a sub-challan** (per section), **+ Add another weaver challan** (opens the same part-card UI and calls `addToMillChallan`; only while Open), **Mark closed / Reopen**
  - an old challan id must still open its old detail view, so keep the old route working
- **PDF** (via the existing `DocPreview`):
  - **full challan** = page 1 is a cover with "Mill Challan 121", mill, GSTIN, date, and a table of sub-challans (sub no, weaver challan no, party, quality **nickname**, takas, meters) with totals. Then **each sub-challan on its own page** (`print-page-break`): sub no, main no, weaver challan no, party, quality **nickname** (never the original name), taka list (taka no, meters), takas and meters totals.
  - **single sub-challan** = just that page.
  - Make sure the multi-page "Share as PDF" output doesn't cut a table row in half across pages. Paginate per sub-challan; if a long taka list needs more than one page, render it in columns or split it cleanly.
- Programs, mill receipt, inventory "Grey at mill" and availability keep working unchanged. They work from taka status and mill, not from challans.
- Replace `createDispatch` usage in the UI with the new functions. Keep `createDispatch` itself working (tests use it), but make it create a main + single sub internally so all new data has a main.

### Change 5: shrinkage only from the mill and folding

**The client's words:** weaver shrinkage isn't counted any more (they don't pay for it), and grey never shrinks between the weaver and the mill. Shrinkage is measured only:
- **at the mill**: grey challan meters − meters on the mill's return challan
- **at folding**: mill meters − folded meters

**Rules:**
- **Per-taka chain** = `grey_meter` (weaver challan) → `finished_meter` (mill challan) → `folded_meter`. This is the same for godown takas and direct-to-mill takas.
- `millShortage = grey − finished`, `foldShortage = finished − folded`, `totalShortage = grey − (folded ?? finished)`. Percentages are against `grey`.
- **Mill receive screen:**
  - remove the editable "mill grey meter" input
  - show the grey (challan) meters read-only beside the finished-meter input, with live shortage per row and in total
  - `createFinishedReceipt` sets `mill_grey_meter = grey_meter` automatically (the column is kept for compatibility); it no longer accepts a different value
- **Removed everywhere:**
  - "weaver loss vs nominal length"
  - "weaver challan → mill grey" (transit)
  - their stage cards, columns and bars in `ShrinkagePage`, `summarize()`, `withLineage()` (keep the fields only if something else needs them, otherwise remove them from the output) and the dashboard wastage card
- **PO screens:** keep ordered vs received vs pending. Rename "Weaver shrinkage" to **"Short received"** (and "Excess received" stays). Remove it from the shrinkage report.
- Update `docs/SPEC.md` decision D-3 and rules R-SH-1..3 / R-PO-4 to match.

### Change 6: damage marking in folding, and all takas preselected

**Preselected:**
- When a mill challan is opened in Folding, **all its pending takas start selected**, with folded meters defaulting to the finished meters as today. The user deselects what they don't want.
- **Add a confirm popup before saving** showing:
  - takas to fold and folded meters
  - total folding shortage
  - number of damaged takas and damaged meters

**Damage:**
- Each row in Folding gets a **"Damage"** action. It opens a modal with:
  - **Damaged meters** (required, > 0, at most 2 decimals, and not more than that row's folded meters)
  - **Photo** (optional): **Camera** + **Upload**, via `uploadImage()` (Cloudinary)
  - **Voice note** (optional): **Record** / **Stop** / play back / re-record using `MediaRecorder` (max 2 minutes, auto-stop), or **Attach** an audio file
  - **Notes** (optional)
- A marked row shows a red **"Damaged X m"** tag. The user can edit or remove the damage before saving.
- **Voice note storage:**
  - Try Cloudinary first: unsigned upload to `/{cloud}/auto/upload` with `resource_type` auto (add an `uploadMedia(file)` helper next to `uploadImage`).
  - If Cloudinary isn't configured or the upload fails, store the recording **only on this device** (IndexedDB, keyed by the damage id) and save `voice_local = 1`.
  - Other devices then show a microphone icon with "Voice note saved on the device that recorded it".
  - Never store audio inside the main database.
- **Data (additive):** new table `taka_damages`:
  - `(id, taka_id NOT NULL, meters REAL NOT NULL, image_url TEXT, voice_url TEXT, voice_local INTEGER DEFAULT 0, notes TEXT, at TEXT NOT NULL)`
  - index on `taka_id`
  - one damage per taka (unique index)
- `foldTakas(rows, date)` accepts an optional `damage` on each row and saves the damages **in the same transaction** as the folding, with a `taka_moves` note `'FOLDED (DAMAGED X m)'`.
- **Sellable meters** = folded − damaged. Use them for:
  - finished-goods stock meters (inventory views, inventory detail, availability, dead stock)
  - order allocation (`allocateOrder` and the allocated meters in `OR_SQL` / `OL_SQL`)

  Taka counts don't change: a damaged taka is still one taka in stock.
- **Show damage clearly:**
  - a "Damaged X m" tag on the taka wherever finished/folded takas are listed
  - a **"Damaged"** filter in Finished goods
  - a **Damage** column in the shrinkage report (by group and per taka), kept **separate** from folding shortage
- **Damage details:** tapping a damaged taka (in folding history, inventory or the shrinkage report) opens a details modal with:
  - taka no, quality nickname, colour
  - damaged meters, folded meters, sellable meters
  - photo (tap to enlarge), voice note (player, or the "on another device" note), notes, date
  - **origin:** weaver challan no + party, mill sub-challan no (e.g. 121B) and main no, program no + mill, mill return challan no

  Damage can't be edited after the folding is saved (record it as an open question in SPEC).

### Change 7: "Loss" becomes "Shortage" everywhere

- Every user-visible "loss" / "Loss" becomes **"shortage" / "Shortage"**:
  - shrinkage report: titles, stage cards, columns, tiles, "Avg … / taka", "by step", "by cost"
  - program detail, mill receive, folding, dashboard, PDFs, empty-state texts
- Search the UI text for `loss` and `Loss`.
- Internal variable names can stay. The page and menu name "Shrinkage Report" stays.

---

## 4. Seed / demo data and tests

- **Update `src/db/seed.js`** so a fresh local database demonstrates the new model:
  - a common colour library (e.g. 8 colours, two of them with an image or data URL)
  - qualities with linked colours, one private colour and one inactive colour
  - mills and customers with GSTIN
  - branches, no racks
  - at least two **main mill challans**, one of them with 3 sub-challans (A, B, C) from three different weaver challans, plus one direct-to-mill receipt
  - programs using quality colours
  - partial mill receipts, folding with 2 damaged takas (one with a note)
  - open POs so change 1 shows numbers

  The seed still only runs into a completely empty **local** database (unchanged rule).
- **Update `tests/e2e.mjs`.** Keep the Ganesh scenario and adapt it to the new rules. **Add checks for:**
  - **availability:** returns open-PO count and pending meters for the quality (closed and fully received POs excluded)
  - **GSTIN:** saved upper-case on mill and customer; an invalid one still saves (warning only)
  - **colours:**
    - quality colour link; a private colour isn't in the library list
    - a program or order with an unlinked or inactive colour is rejected
    - a used colour can't be removed from a quality, only made inactive
    - the "last used" dates come out right
  - **main mill challan:**
    - two weaver challans in one save → main `1` with subs `1A`, `1B`
    - `addToMillChallan` adds `1C`; adding takas of the weaver challan of `1A` again extends `1A`
    - a closed main refuses additions; reopen works
    - takas from a different weaver challan than the part says are rejected
    - double send is rejected
    - failed saves leave no rows
  - **shrinkage:** per-taka `millShortage = grey − finished`, `foldShortage`, `totalShortage = grey − folded`, the same for a direct taka; no weaver/transit figures in report groups
  - **damage:**
    - folding with damage saves the damage in the same transaction
    - damaged meters > folded is rejected
    - sellable meters = folded − damaged are used in inventory and in order allocation
  - **reconciliation:** inventory still reconciles
  - **batching:** a 300-taka receipt, send and fold works, and the statement count per save stays within the F-1 target (count the statements in the test driver)
- Both `npm test` (sql.js) and `npm run test:libsql` (Turso code path on a local file) must pass.

---

## 5. Order of work (one commit each)

1. **Baseline:** the `.env.development.local` safety file, a clean install, baseline test/lint/build results in PROGRESS.md.
2. **F-2 + F-3:** remove the auto-wipe; fix the AGENTS.md paths.
3. **F-1:** schema version + batch start-up, batched writes in the existing functions, the libsql test mode. All existing tests are green in both modes before going on.
4. **Change 2:** GSTIN.
5. **Change 7:** the wording change (a quick, isolated change, done early so later screens use the new words).
6. **Change 5:** shrinkage rules, mill receive screen, report, dashboard, PO labels.
7. **Change 3:** colour library, quality colours, removal of items and charts from the UI, programs/orders/availability/PDF.
8. **Change 4a:** remove racks from the flow.
9. **Change 4b:** main + sub mill challans (repo, list, new screen, detail, PDF).
10. **Change 6:** folding preselect + confirm, damage modal, storage, sellable meters, damage details.
11. **Change 1:** open POs in the availability panel.
12. **Seed + tests:** finish the seed and all new tests; run both test modes, lint, the `localtest` build and a full browser walk-through (below).
13. **Docs** (§6).

After steps 3, 7, 9 and 12, re-run the **whole** flow in the browser:

masters → PO → grey challan (godown + direct) → main mill challan with 3 parts → add a 4th part → close → program with quality colours → partial mill receipt → folding with all preselected, one damaged → inventory (all four views reconcile, damaged tag, sellable meters) → shrinkage report → create an order (availability shows open POs, colours, stock) → auto-allocate.

Check at **tablet width (about 820 px)** and **desktop (1440 px)**, plus a quick phone check (390 px):
- no sideways page scroll
- no console errors
- every PDF opens, prints and shares

---

## 6. Docs to update (keep the project resumable)

- **`docs/SPEC.md`:**
  - **R-M-2/5:** colour library + quality colours, no item codes, no charts
  - **R-M-3/6:** GSTIN
  - **R-LOC-\*:** racks retired, branches stay
  - **R-SM-\*:** main + sub mill challans against weaver challans, no picking list
  - **R-PG-\*:** quality colours, no chart
  - **R-FR-\*:** finished meters only, grey from the challan
  - **R-FD-\*:** add **R-FD-4 damage** + sellable meters
  - **R-SH-\*:** mill + folding shortage only, damage separate
  - **R-SO-1:** open POs block
  - **"Shortage" wording**
  - **New decisions:** Turso stays browser-direct (known risk); no auto-wipe; voice-note storage rule; old challans shown as "Old challan"
  - **Open questions:** damage editing after save, cancelling a sub-challan, roles/login, booking/reservation, rates
- **`docs/AUDIT.md`:** a new section "Client changes 1" with a traceability row per change (✅/⚠️ + files), plus the known-risk note on the Turso token in the browser bundle.
- **`docs/MIGRATIONS.md`:** every new table, column, index and link-row backfill, the hidden `__library__` chart, and `schema_version`, each with its undo.
- **`docs/tasks/`:** update `01-masters`, `04-rack-assignment` (status: Retired), `05-send-to-mill`, `06-program`, `07-mill-receipt-folding`, `08-shrinkage-report`, `09-inventory` and `10-availability` (what to do / what to check / done when / status / files).
- **`docs/PROGRESS.md`:** a Session 3 log covering:
  - what was done
  - test results in both modes
  - the list of rewritten tests
  - anything not verified and why
- **`README.md`:**
  - run/test commands, including `test:libsql` and the `localtest` build/preview
  - the `.env.development.local` safety note
  - Cloudinary env names
  - the deploy steps below

**Deploy steps for the TL** (write these in README, don't run them):

1. **Cloudinary:** Settings → Upload → *Add upload preset* → Signing mode **Unsigned**, folder `vinee-creation`, allowed formats images + audio. Note the preset name and the **cloud name** (Dashboard). The API key and secret are **not** used by this app.
2. **Vercel:** Project → Settings → Environment Variables → add `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`. Check `VITE_TURSO_DATABASE_URL` / `VITE_TURSO_AUTH_TOKEN` are set for Production.
3. **Redeploy.** On first open, the app upgrades the Turso database automatically (additive only) and records `schema_version`.
4. **Smoke test on the live site:**
   - create one test PO and grey challan
   - check they appear on a second device
   - delete nothing

---

## 7. Final report

At the end, send a short summary:
- what changed, per change 1–7 and F-1..F-3
- test results (both modes), lint and build
- screens checked at which widths
- anything not done or not verified, and why
- the open questions
- the exact deploy steps for the TL
