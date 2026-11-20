# Progress log

## Session 1 (audit) — 2026-10-11
Branch `audit-fixes` (baseline commit "Baseline before audit" on `master`). One commit per fix group.

Done: Phase A (`docs/AUDIT.md`); P0 (transactions, state machine + history, server-side validation for receipt/dispatch/program/mill receipt/folding, PO statuses, seed double-insert under StrictMode, remote-DB safety); P1 (rack assignment page, picking list + printable challan, program split/PDF, folding, inventory (4 views + reconciliation), availability, shrinkage report); P2 (inline errors, no double submit, pagination, masters validation); docs.
Verified: `npm test` (56 checks incl. the §4 scenario), `npm run build`, browser smoke of dashboard/inventory/assignment/dispatch/shrinkage/receipt grid (500-row paste in ≈1 s, total exact).

Not verified (and why): Turso code path (`tx()` on libSQL) — no test database allowed; printing output on paper (only on-screen layout checked); phone-width layouts only checked via CSS review; mill-facing PDFs are browser print, not generated files.

Next / for the owner: delete `test-db.js` and rotate its Turso token; answer the open questions in `docs/SPEC.md`; add `vercel.json` SPA rewrite before deploying; consider moving DB calls behind an API before production (token is in the browser bundle).

## Session 2 — filters (2026-10-12)
Fixed every dropdown filter: `Select` now returns string values (filters compared with strings, so quality/challan filters matched nothing) and keeps its empty option ("All …") selectable so a filter can be reset to all. Dependent challan filters follow the quality filter; inventory ignores filters that are hidden in the current view. Checked in the browser: mill-challan quality filter, rack page quality/rack filters, inventory shade filter + view switch.

## Session 3 (client changes 1) — 2026-10-16
Source: `vinee-client-changes-1-prompt.md`. Per the owner, nothing was committed and no branch was created in this session (the whole working tree is committed later).

**Baseline before any change:** `npm test` 86 passed / 0 failed; `npm run lint` warnings only; `npx vite build --mode localtest` OK. Safety files `.env.development.local` and `.env.localtest.local` created (git-ignored).

**Done:** F-1 (schema_version, batched start-up, multi-row writes, libsql test mode, readable DB errors), F-2, F-3, changes 1–7 (details in docs/AUDIT.md §10), seed rewritten for the new model, docs, README deploy steps.

**Final results:** `npm test` **176 passed / 0 failed**; `npm run test:libsql` **176 passed / 0 failed**; lint: warnings only (no errors); `npx vite build --mode localtest` OK. A 500-taka receipt, send, program, mill receipt and fold each stay within 20 statements (asserted in the tests, both drivers).

**Rewritten checks (old rule → new rule):** rack assignment/history → rack ignored, branch only; rack picking list → sub-challans per weaver challan; item codes/generateItems → colour library + quality colours; programs need a shade chart → programs use quality colours (no chart); "direct taka starts at mill grey" → same grey → finished → folded chain; weaver-loss checks → removed, mill/fold/total shortage; dispatch checks → createMillChallan/addToMillChallan.

**Browser walk-through (local mode, desktop width):** fresh seed; mill challan list, new mill challan (part card → Done → summary), main detail PDF preview (cover + sub pages), masters shades grid, quality colours panel, folding (preselected, Damage modal, confirm popup, fold), inventory finished with Damaged tag/filter, shrinkage report. No console errors. Also opened a browser that still held the previous demo database: it upgraded and its challans show as "Old challan".

**Not verified, and why:** tablet (820 px) and phone (390 px) layouts and the no-sideways-scroll rule (the automation could not resize the viewport; layouts use responsive classes only); PDF output of a colour photo hosted on Cloudinary (no Cloudinary access; `useCORS` is on); microphone recording and Cloudinary upload of voice notes; the real Turso database (never touched, by design); printing on paper.

**Decisions:** see docs/SPEC.md D-10..D-15. Open questions 11–13 added.

## Session 4 (client changes 2) — 2026-10-20
Source: `vinee-client-changes-2-prompt.md`. Nothing committed, no branch created. **Backup:** `../vinee-backup-2026-10-20-0139/` (src, tests, docs, package files).

**Baseline before any change:** `npm test` 176 passed / 0 failed; `npm run test:libsql` 176 / 0; `npm run lint` 1 error (the hooks bug in InventoryDetailPage) + warnings; `npx vite build --mode localtest` OK.

**Done:** everything in §1–§7 of the prompt (see docs/AUDIT.md §11, docs/SPEC.md R-JW / R-WD / R-GS / R-SO-3 / R-INV, docs/MIGRATIONS.md schema_version 4, docs/tasks 11–13).

**Final results:** `npm test` **338 passed / 0 failed** (incl. the seed check); `npm run test:libsql` **329 passed / 0 failed** (the seed check runs only on the in-memory driver because a reset is refused on a Turso-mode database); lint: 0 errors, warnings only; `npx vite build --mode localtest` OK. 300-taka job work send, receive, withdrawal, grey sale and grey withdrawal each stay within 20 statements.

**Rewritten tests:** none of the 176 existing checks needed a rule change (all new checks are added after them).

**Browser walk-through (local mode, fresh database on a second dev port, desktop width):** every new/changed route opened with no crash and no console errors: all Inventory stages and modes, detail pages for each view (godown, mill, dyeing, finished, jobwork, dead, damaged), job work list/detail/receive/new, the four withdraw forms, withdrawal and grey sale detail, orders, availability, shrinkage, masters. JW-1 detail and its challan PDF preview checked visually.

**Not verified, and why:** 820 px and 390 px layouts and the no-sideways-scroll rule (the automation cannot resize the viewport: it kept reporting 1536 px); the full click-through of forms to a saved result in the browser (the repo functions behind them are covered by tests; the form screens were opened but not filled in by hand); PDF download/share and paper print; upgrade of a real Turso database (never touched, by design — take a snapshot before first open).

## Session 5 (client changes 3) — 2026-10-22
Source: `vinee-client-changes-3-prompt.md`. Nothing committed, no branch created. **Backup:** `../vinee-backup-2026-10-22-0045/` (src, tests, docs, package files).

**Baseline before any change:** `npm test` 338 passed / 0 failed; `npm run test:libsql` 329 / 0; lint 0 errors (warnings only); `npx vite build --mode localtest` OK.

**Done:** §1 programs against weaver challans, §2 lot-wise mill receipt, §3 the taka display, §4 tablet-first rules, §5 tests + viewport check, §6 seed, §8 docs (SPEC R-PG / R-FR rewritten, R-UI-1, R-UI-2, D-20..22, open questions 18–19; AUDIT §12; MIGRATIONS schema_version 5; tasks 06 and 07).

**Final results:** `npm test` **396 passed / 0 failed**; `npm run test:libsql` **384 passed / 0 failed** (the seed checks run only on the in-memory driver); lint 0 errors; `npx vite build --mode localtest` OK. A 500-taka program issue and a 500-taka mill receipt stay within 20 statements. **No existing test needed rewriting** (the old `createProgram` and `createFinishedReceipt` signatures still work; all new checks are added after the old ones).

**Queries changed for multi-quality programs** (a line's quality is `COALESCE(pl.quality_id, pr.quality_id)`): `QC_SQL` last program + used count, `removeQualityColour` used-check, `PG_SQL` (qualities list, quality ids, challan count), `FR_SQL` (qualities, lots), `LINES_SQL` (line quality, weaver challan, party, direct / sub), the `quality_shades` backfill in schema.js, the program list quality filter. Takas' own quality (shrinkage, availability, inventory, dashboard) always came from the PO (`grey_pos`), so those queries did not change; a regression test checks their numbers.

**Taka display (R-UI-1) — places changed:** new `src/components/TakaGrid.jsx` (`TakaChip`, `TakaGrid`, `TakaList`, `TakaBadge`). Used in: mill challan part cards (`PartBuilder`), mill challan detail (sub-challan lists, old challan list), mill challan PDF (sub pages and the old-challan document), program builder, program detail, program PDF, mill receipt screen, job work PDF and the pick preview (`FgLines`), grey sell picker (`GreyTakaPicker`), grey sale PDF. Tables with the same emphasis (muted `#no`, dominant meters): grey challan entry grid (`CreateReceiptPage`), receipt detail, folding (a Taka and a Lot column were added — there was no taka number there before), inventory detail, job work receive tiles and detail, grey sale detail, withdrawal detail, damage details (lot).

**Lot number shown in:** folding (card chips, row, folded list, search), inventory detail (column + search), damage details, job work detail, withdrawal detail, availability per colour (lots in stock), program detail and the mill receipts list.

**Tablet-first (R-UI-2) changes:** modals now fit the screen height with internal scroll (`Modal` in ui.jsx); all text inputs and the select search use 16 px text (`Input`, `Select`, `SearchToggle` and the page-level inputs); the program builder and the receive screen use a sticky bottom summary bar below `lg` and a right column from `lg`; long names truncate; the phone overflow of the receive screen's challan picker was found by the check and fixed (`min-w-0`).

**Viewport check (Playwright, driven through a scratch folder outside the project — `package.json` untouched — with the installed Chrome against `vite preview --mode localtest`):** exact viewports 768×1024, 1024×768, 820×1180, 1180×820, 1280×800, 1440×900 and 390×844; 30 screens each (dashboard, PO, grey challan new/detail, mill challan list/new/detail, programs list/detail/add/old, program new step 1 + step 2 empty + with takas + colour sheet + assigned, receive step 1 + step 2, folding, job work list/detail, inventory + finished + detail, orders list/new, availability, masters, shrinkage). Assertion `documentElement.scrollWidth <= innerWidth` (and the same for `<main>`): **all 210 screens pass** after one fix (receive step 2 at 390×844). No console errors. Screenshots: `docs/screens/<route>-<w>x<h>.png` (about 18 MB; delete the folder when no longer needed). I looked at the program builder, colour sheet, receive, program detail, folding and grey challan screens at tablet widths.

**Not verified, and why:** the print/PDF output of the new program document and the other taka-list PDFs on paper (only the on-screen preview layout); Safari/iPadOS itself (checked with Chrome at tablet sizes; the rules — 16 px inputs, no `:has()` layouts, no hover-only actions — were followed by construction); a long weaver-challan list in the pickers at 500+ takas in the browser (the repo path is tested to 500 takas); microphone recording and Cloudinary upload (unchanged); the real Turso database (never touched).
## Session 6 (client changes 4)
**Backup:** `../vinee-backup-2026-10-22-1501/` (src, tests, docs, package files) taken before any change.
**Baseline (before):** `npm test` 396 passed · `npm run test:libsql` 384 passed · `npm run lint` warnings only · `npx vite build --mode localtest` OK. Both `.env.development.local` and `.env.localtest.local` exist with empty Turso values; the real database was never touched.
**Done:** §1 Sell to order · §2 stock on order detail + Allocate now · §3 full-width desktop (`.page-w*`, form grids, 340 px summary column, taka grid 8/10 columns, order detail two columns) · §4 Folding → In mill + restricted receive · §5 3-step receive + confirm · §7 seed (open normal order SO-0006, open job-work order SO-0007; In mill is fed by the existing programs) · §9 docs. No schema change (`SCHEMA_VERSION` untouched, MIGRATIONS.md unchanged).
**Final:** `npm test` 434 passed · `npm run test:libsql` 418 passed · lint warnings only (none new) · `localtest` build OK. Rewritten tests: none (only additions).
**Viewport check (Playwright via a scratch folder outside the project, installed Chrome, `vite preview --mode localtest`):** 768×1024, 1024×768, 820×1180, 1180×820, 1280×800, 1440×900, 1920×1080, 390×844 × 35 routes = 280 screens: `scrollWidth <= innerWidth` passes everywhere, no console errors. Screenshots in `docs/screens/round4/`. Looked at: order detail, Sell to order, In mill, receive step 3 (1440, 1920, 1180, 820).
**Browser walk-through (local mode, 1440×900 and 820×1180):** In mill → receive PG-0001 with two lines sharing one lot → one lot card, Enter-key entry → confirm → *Fold these takas now*; order SO-0006 → *Allocate now* → partial give (order stays open) → *Allocate now* again → order Done → in Sell history. All steps passed, no console errors.
**Bug found and fixed:** `availabilityDetail` threw as soon as a finished taka had a lot number (D-26).
**Not verified / limits:** the program-detail (full mode) receive was exercised through the same component in folding mode (the routes differ only in back / save targets); detail pages other than the order detail keep a single column at wide widths (fact lists and tables use the full width, but there is no separate side panel); Safari/iPadOS itself; paper print; the real Turso database (never touched). `dist/` currently holds a `localtest` build — run the normal build before deploying.

## Session 7 (client changes 5) — 2026-10-30
**Done:**
- **Names:** Masters "Parties" tab → **Weavers**; party group → **Firm** ("Add Firm"); party inside a firm → **Associated party** ("Add Associated Party"). Changed on every screen that showed them (PO form/list/detail, grey challan form/list, mill challan builder + documents, program builder, inventory filters/table, shrinkage tab, grey sale/withdraw forms) and in repo error messages. Table/column names are unchanged (`weaver_groups`, `weavers`, `group_id`).
- **GST number (optional)** on every party type: firm (new column), associated party, mill, customer, job worker — one shared field (`GstField`), trimmed + upper-case, amber hint when it does not look valid, never blocks saving. Also used by the quick-add customer / job worker popups. Firm GST shows on the PO details.
- **Master details screens** (`/masters/view/:kind/:id`, `MasterDetailPage.jsx`, data from `repo.getMasterDetail`): clicking any master entry opens its details; own fields first, then: firm → associated parties, POs, challans, stock per stage; associated party → challans, stock, grey sales; mill → mill challans, programs, stock at the mill, finished received; customer → orders (received/ongoing/completed), payment totals, grey sales; job worker → challans, pending; quality → orders received/ongoing/completed, inventory per stage (+ **View inventory**, each stage tile opens that stage), dead stock, POs, programs; branch → grey here by quality, challans; shade → qualities, orders, programs, finished stock. Edit/Delete on the details screen. Screens opened from a details screen (inventory, PO, challan, order, program, job work, mill challan, grey sale) come **back to it** (`navigate` state `from`, `useBackTo`).
- **Settings** is a full screen (`/settings`) instead of a popup: payment reminder (new), dead stock, storage, backup, reset.
- **Order rate + payments:** rate per meter on the order form (required for new orders; optional on edit so old orders still save) and an own reminder-days field (empty = Settings default); the form shows the amount to receive. Order details → **Payment** card: total expected, dispatched meters, billable, received, current payment due, still to receive, reminder date, **Log payment** (several entries, delete), per-order reminder days. Order list → **Payment due** chip + filter; dashboard banner; sell history now shows order amounts when a rate is set. Demo seed: rates on all orders, a firm GST number and one part payment.

**Decisions (D-27 … D-31):**
- D-27 "Dispatched" for a customer order = the takas given to it (status SOLD, `order_id` set) at their **sellable** meters — the same meters allocation already uses. Billable amount = dispatched meters × rate.
- D-28 Total expected = rate × ordered meters; a line in takas only counts takas × the quality's taka length and is marked "approx."; once the order is completed the expected amount is what was dispatched (takas are never cut, so it may differ a little from the order).
- D-29 Reminder: the counter starts on the day the order first owes money (its first dispatch, or a dispatch after it was fully paid). Any payment entry — even partial — restarts it from the payment date. "Payment due" shows when the counter reaches the reminder days and money is still owed. A fully paid (or over-paid) order never shows it. Without a rate the amount is unknown, so the reminder only uses the dates.
- D-30 Changing the Settings default applies to every order that has no own days (stored as NULL), including existing ones.
- D-31 Dates of dispatches come from `taka_moves.at` (UTC), payments from the entered date.

**Final:** `npm test` 478 passed (44 new) · `npm run test:libsql` 462 passed · lint: warnings only · build OK.
**Browser walk-through (local mode, no env files, scratch Chrome driver; 1280×900 and 390×844):** masters tabs + add firm, firm → associated party details, quality details → View inventory → back to the quality, customer/mill/job worker/branch/shade details, settings (90 days saved and used as the order-form default), create order fields, order details → Log payment → entry listed, orders `?payment=due` filter; no console errors, no horizontal scroll on the phone width.
**Not verified:** the real Turso database (never touched — schema v6 runs there on first open; take a snapshot first); print documents (unchanged).

## Session 8 (brand theme + tablet UI) — 2026-10-30
Client sent `Vinee_Creations_ERP_Green_Theme_*.pdf` (palette "Emerald Heritage") and `Vinee_Creations_Green_Logo_*.pdf`.
- **Theme:** tokens in `tailwind.config.js` + `src/index.css`. The stock Tailwind names the screens already use (`slate`, `emerald`, `amber`, `red`, `sky`, `violet`, `orange` …) are redefined from the brand tokens, so every screen follows without per-file edits. Named brand colours: `forest`, `sage`, `mint`, `ivory`, `gold`. Headings use Manrope (`font-display`), body Inter.
- **Logo:** the round badge cut out of the logo PDF (transparent corners) → `src/assets/logo.png` (shell + printed letterhead), `public/favicon.png`, `apple-touch-icon.png`, `pwa-192/512`, `maskable-512` (badge on forest). Manifest/theme colour forest.
- **Tablet shell (`AppShell.jsx`):** portrait tablets (768–1023) get a fixed forest icon rail (no hamburger); landscape tablets and desktops (≥1024) a forest sidebar grouped Sales / Grey / Processing / Stock & reports, Masters + Settings at the bottom — sized to fit an 820 px-tall screen. Phones keep top bar + drawer.
- **Kit:** 44 px touch targets everywhere (buttons `sm` 40 px, icon buttons 40 px, dropdown rows 44 px), emerald focus ring, pill badges, step tabs tick finished steps, `PageHeader` actions wrap under the title instead of squeezing it.
- **`ActionBar` (kit):** the save / totals bar pinned to the bottom of the screen on tablets and phones — replaces five copy-pasted sticky bars and the fixed bar on Receive job work; added to Create PO, Create order, Grey challan (takas step), job work + withdrawal forms.
- **No sideways scrolling on tablets:** table headers may wrap; lists move secondary columns into a second line below 1280 px (grey challans, PO receipts, inventory stage list, masters); PO and Dyeing lists start in card view on tablets until the user picks a view.
- **Fixed on the way:** inventory stage list showed the lot under "Colour" and the colour under "Lot" (cells were in the wrong order).

Decisions:
- D-32 Brand palette applied by redefining Tailwind's colour scales (not by rewriting ~1,500 class names); stage colours (mill / dyeing / job work) kept distinct but muted to sit with the greens.
- D-33 Tablet = 768–1366 px, touch. Portrait gets the icon rail, landscape the full sidebar; the bottom action bar shows below 1024 px (below 1280 px on screens whose summary column only appears at xl).
- D-34 App branding reads "Vinee Creations" as on the client's sheets; the printed letterhead text ("Vinee Creation") is unchanged pending the client's confirmation of the legal name.

**Final:** `npm test` 478 passed · build OK · viewport sweep (Playwright, local mode, scratch folder) 390×844, 768×1024, 820×1180, 1024×768, 1180×820, 1440×900 × 34 routes: no page overflow, no console errors; tables no longer scroll sideways at 820 and 1180.
**Not verified:** a real iPad / Android tablet (Safari safe areas, on-screen keyboard over the bottom bar); printed documents with the new letterhead logo.

## Session 9 (WhatsApp payment reminders) — 2026-10-30
- **Masters → Message templates** (new table `message_templates`, schema v7): name + message. In the editor the user types the text and taps field chips to insert placeholders where the cursor is — {Customer name}, {Contact person}, {Order no}, {Order date}, {Quality}, {Amount due}, {Billed amount}, {Received}, {Due date}, {Days late}, {Today} — with a live WhatsApp-style preview. Two starter templates ("Polite reminder", "Detailed reminder") are added by a migration only while the table is empty.
- **Order details → Payment:** a WhatsApp icon, always shown. It opens a dropdown of the templates (+ "Manage templates"); picking one shows the filled message and the customer's phone (from Masters), both editable, then **Open WhatsApp** opens `https://wa.me/<number>?text=…` (app on tablets / phones, WhatsApp Web on computers). Nothing is sent by the app itself — the user presses send in WhatsApp.
- Logic in `src/lib/whatsapp.js` (fields, fill, phone normalisation, link); UI in `src/pages/masters/Templates.jsx` and `src/pages/orders/OrderPayments.jsx`.

Decisions:
- D-35 Placeholders are readable words in braces ({Amount due}), matched case-insensitively; an unknown {…} is left as typed. A 10-digit number (optionally with a leading 0) is treated as an Indian mobile and gets 91; with no number WhatsApp asks for the contact.
- D-36 wa.me click-to-chat (no WhatsApp Business API): no account, cost or approval needed, and the user always sees the message before sending.

**Final:** `npm test` 496 passed (19 new) · `npm run test:libsql` 480 passed · build OK · walkthrough at 820×1180 (templates master, editor with field insert, order → icon → dropdown → send screen → wa.me link with the filled text): no console errors.
**Not verified:** sending from a real device's WhatsApp; production (schema v7 upgrades the live database on first open — additive: one new table + the two starter templates).
