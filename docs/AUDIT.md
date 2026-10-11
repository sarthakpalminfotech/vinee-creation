# Vinee Creation — Audit

Branch `audit-fixes`. Baseline commit: "Baseline before audit" (project had **no git history** before; `git init` done by the audit).
Status legend: ✅ works · ⚠️ partly · ❌ broken · ⛔ missing. Issue status is updated in place (see §6 and the final column).

## 1. Stack and how to run

- Frontend: React 19 + Vite 8 + React Router 7 + Tailwind 3 (JS, no TypeScript). PWA via vite-plugin-pwa.
- Backend: **none**. All data access is in the browser (`src/db/repo.js`). DB = sql.js (SQLite WASM) persisted to IndexedDB, or Turso (libSQL over HTTP) when `VITE_TURSO_DATABASE_URL` is set.
- Auth/roles: none. Hosting: Vercel (`vercel.json` is **missing**, though the specs mention an SPA rewrite).
- Env names: `VITE_TURSO_DATABASE_URL`, `VITE_TURSO_AUTH_TOKEN`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`, (added by audit) `VITE_ALLOW_DEMO_SEED`.
- **Which DB?** No `.env*` file exists → the app runs in **local mode** (browser IndexedDB). All audit work used fresh in-memory sql.js databases (`tests/`). No remote DB was touched. `test-db.js` (repo root) contains a **live Turso URL + auth token in plain text** — it was NOT run and is excluded from the git baseline (`.git/info/exclude`). **Action for owner: delete the file and rotate that token.**
- Commands: `npm install`, `npm run dev`, `npm run build`, `npm run lint`, `npm test` (added: audit tests).
- Errors hit while setting up: none (build passes at baseline; lint = warnings only).

## 2. Existing documentation
- `AGENTS.md`, `specs/01-business.md`, `02-architecture.md`, `03-data-model.md`, `specs/dots/D00..D15`. `specs/PROGRESS.md` is referenced everywhere but **did not exist**. Spec 01 says taka-level weaver shrinkage = nominal − grey and total starts at nominal; the audit brief (§2.9) says the chain starts at the weaver grey meter → brief wins (decision D-3). Spec says PO status OPEN/PARTIAL/COMPLETED; brief wants Open/Partly received/Received/Closed (short) → brief wins.
- New docs live in `docs/` (SPEC, AUDIT, PROGRESS, tasks/, MIGRATIONS). `specs/` kept; `docs/` is the authority.

## 3. Fixes already made by hand
No git history existed, so none can be listed from commits. From code evidence: the dot files claim D00–D15 done. Several are not working (see issues). Hand-fixes visible in code: `Select` component, Drawer-style pages. No evidence of reverted fixes.

## 4. Inventory (baseline)
Routes: `/` dashboard, `/masters/:tab`, `/po(/new|/:id)`, `/receipts(/new|/:id)`, `/dispatch(/new|/:id)`, `/programs(/new|/:id|/:id/receive)`, `/folding`, `/assignment`, `/orders(/new|/:id)`. No API (client-only). Tables (17): weaver_groups, weavers, mills, customers, qualities, locations, shade_charts, shades, grey_pos, grey_receipts, takas, mill_dispatches, programs, program_lines, finished_receipts, orders, order_lines. Print: browser print of dispatch & program detail pages. No background jobs.

## 5. Baseline result (run, not read)
`node tests/e2e.mjs` on the unmodified repo (only difference: sql.js loadable under Node): **18 passed / 26 failed**.
Regression checklist of things that WORKED at baseline (must still pass at the end) — covered by e2e checks: PO opens OPEN; receipt of 48 takas saves exact meters (94.69, 102.58, 103.5), PO shows PARTIAL and exact received total; direct-to-mill receipt puts takas straight in MILL_GREY with no rack; bulk rack assign of 24 takas; dispatch of 36 of 48 with nickname; program 24×37 + 24×39 allocates 48 takas IN_DYEING; partial mill receipt 30/18; finish loss per taka; folding loss; direct taka loss starts at mill grey. Seed baseline: 167 takas — GODOWN 83, MILL 4, DYEING 46, FINISHED 14, FOLDED 10, SOLD 10; POs: 3 non-completed (71,382.33 m pending). Build: `npm run build` OK. UI pages that rendered by code reading: Dashboard, PO list/detail/create, receipts list/detail, dispatch list/detail/create, program list/detail/create/receive, folding, orders list/detail/create, masters (all tabs).

## 6. Traceability matrix (baseline → final status in last column)

| Rule | Where | Baseline | Note | Final |
|---|---|---|---|---|
| R-M-1 groups/parties | schema weaver_groups/weavers, MastersPage | ⚠️ | works but called "weaver"; no validation/duplicates | ✅ |
| R-M-2 two names | qualities; mill/customer screens | ⚠️ | ProgramDetail screen shows original name; PO/receipt (weaver side) show nickname first | ✅ |
| R-M-3 mills | mills | ✅ | | ✅ |
| R-M-4 shop→rack | locations | ⚠️ | no duplicate check | ✅ |
| R-M-5 shades+colour | shades.hex | ⚠️ | no hex/duplicate validation; shade-chart change kept stale lines | ✅ |
| R-M-6 customers | customers | ✅ | | ✅ |
| R-PO-1 PO create | CreatePoPage, createPO | ⚠️ | PO number auto-filled, not unique, no validation server-side | ✅ |
| R-PO-2 list/statuses | decoratePo | ⚠️ | only OPEN/PARTIAL/COMPLETED; "closed short" indistinguishable | ✅ |
| R-PO-3 partial receipts | createReceipt | ⚠️ | works but closed/complete PO not enforced server-side | ✅ |
| R-PO-4 weaver shrinkage | PoDetailPage | ⚠️ | meters only, no %, not on list | ✅ |
| R-GR-1 receipt header | CreateReceiptPage | ⚠️ | group restriction UI only; no server check | ✅ |
| R-GR-2 takas grid | CreateReceiptPage | ❌ | Bulk Paste button calls undefined `handleProcessPaste` (crash); no duplicate check; Enter adds row without focus; >2 decimals silently rounded | ✅ |
| R-GR-3 PO update | PO_SQL | ✅ | | ✅ |
| R-GR-4 direct to mill | createReceipt | ⚠️ | works; mill not validated server-side | ✅ |
| R-LOC-1 bulk rack | LocationAssignmentPage | ❌ | page lists FOLDED takas, uses non-existent fields (`l.name`, `quality_name`, `location_name`) so racks can't be picked; repo accepts any taka | ✅ |
| R-LOC-2 move + history | — | ⛔ | no history table | ✅ |
| R-LOC-3 stock by location | — | ⛔ | | ✅ |
| R-SM-1 pick takas/receipt | CreateDispatchPage | ⚠️ | no select-by-challan | ✅ |
| R-SM-2 picking list by rack | — | ⛔ | | ✅ |
| R-SM-3 challan nickname/print | DispatchDetailPage | ⚠️ | nickname ok; print includes app chrome | ✅ |
| R-SM-4 leave godown | createDispatch | ⚠️ | rack kept on taka | ✅ |
| R-SM-5 no double send, 1 tx | createDispatch | ❌ | silently skips non-godown takas, orphan dispatch rows, no tx | ✅ |
| R-PG-1/2 program + split | CreateProgramPage/createProgram | ⚠️ | no "program total"; duplicate shade lines allowed; no tx | ✅ |
| R-PG-3 program PDF | ProgramDetailPage | ⚠️ | swatch ok, no meters per shade, print includes chrome | ✅ |
| R-PG-4 only grey at that mill | millGreyTakas | ⚠️ | filtered but not rechecked in tx | ✅ |
| R-FR-1..4 mill receipt | ReceiveProgramPage, createFinishedReceipt | ⚠️ | can receive same taka twice (no status guard), no tx, no per-taka loss display | ✅ |
| R-FD-1..3 folding | FoldingPage, foldTakas | ⚠️ | quality column blank (`quality_name`), no state error, no tx | ✅ |
| R-SH-1..3 report | withLineage only | ⛔ | no report screen; total started at nominal not grey (wrong vs brief) | ✅ |
| §2.10 four inventory views | — | ⛔ | | ✅ |
| R-SO-1/2 availability | CreateOrderPage panel | ⚠️ | counts only, no mills/programs/locations/meters | ✅ |
| R-G-1 UI | all | ⚠️ | `shadow-card` class undefined; print shows sidebar | ✅ |
| R-G-2 lists | all | ⚠️ | no pagination, no error states | ✅ |
| R-G-3 validation | all | ⚠️ | `alert()`; double submit possible | ✅ |
| R-G-4 decimals | repo | ⚠️ | REAL columns; SUM unrounded in SQL | ✅ (see decision D-1) |
| R-G-5 transactions | client.js | ❌ | none exist | ✅ |
| R-G-6 state machine + history | repo | ❌ | no guards, no history | ✅ |

## 7. Issue list

| ID | Sev | Module | Issue | Status |
|---|---|---|---|---|
| I-01 | P0 | DB | No transactions: failed receipt/dispatch/program leave orphan/partial rows (e2e proves) | fixed |
| I-02 | P0 | Dispatch | Non-godown takas silently skipped; double-send possible | fixed |
| I-03 | P0 | Mill receipt | Same taka can be received twice; any status accepted | fixed |
| I-04 | P0 | Folding | Any status accepted | fixed |
| I-05 | P0 | Receipt | No server validation (group, mill, duplicates, closed PO, decimals) | fixed |
| I-06 | P0 | Receipt UI | Bulk paste crashes (`handleProcessPaste` undefined) | fixed |
| I-07 | P0 | Rack | Assignment page unusable (wrong status/fields); repo racks any taka | fixed |
| I-08 | P0 | Reset | "Reset Demo Data" would wipe a Turso database; auto-seed could write demo into a real DB | fixed |
| I-09 | P1 | PO | Statuses/shrinkage (R-PO-2/4) | fixed |
| I-10 | P1 | Rack | No location history/by-location view | fixed |
| I-11 | P1 | Dispatch | No pick list by rack; no select by challan | fixed |
| I-12 | P1 | Reports | No shrinkage report; wrong chain start | fixed |
| I-13 | P1 | Inventory | No four views / reconciliation | fixed |
| I-14 | P1 | Availability | R-SO-1 detail missing | fixed |
| I-15 | P1 | Program | No total/split check, PDF lacks meters, quality original name on mill screen | fixed |
| I-16 | P1 | Folding | Quality column blank; no shrinkage shown | fixed |
| I-17 | P2 | All | alert(), no inline errors, double submit, no pagination, no error states | fixed |
| I-18 | P2 | Masters | No validation/duplicates, delete without confirm | fixed |
| I-19 | P2 | Print | Sidebar/drawer chrome printed | fixed |
| I-20 | P3 | UI | `shadow-card` undefined; `Empty subtitle`; unused imports | fixed |
| I-21 | P3 | Repo | `test-db.js` has live token (not committed; owner must delete + rotate); `vercel.json` missing | open (owner) |
| I-22 | P3 | Docs | `specs/PROGRESS.md` missing | fixed (docs/PROGRESS.md) |

## 8. Decisions and open questions
See `docs/SPEC.md` §Decisions and §Open questions.

## 9. Final verification (end of session 1)
- `npm test` → **56 passed, 0 failed** (baseline: 18/26 on the same scenario). `npm run build` OK. Lint: warnings only.
- End-to-end scenario §4 (actual numbers): Receipt 1 = 48 takas, **4,800.77 m** exact (94.69 / 102.58 / 103.5 kept), PO → Partly received; Receipt 2 = 20 takas direct to M1, **1,991.00 m**, nothing added to godown; 24 → Rack-A, 24 → Rack-B; send 36 of 48 → picking list Rack-A 24 / Rack-B 12, challan shows *Gold Lava*, 12 stay in godown; program 48 (36 + 12 direct) 24 × 37 + 24 × 39; partial mill receipt 30 (+1 direct taka) → 17 left in dyeing; folding 10 with corrected meters; per-taka chains correct for a godown taka and a direct taka; PO closed short → status Closed (short), shortfall = 50,000 − received; inventory 12 + 25 + 17 + 31 (+0 sold) reconciles to all 68… active takas; availability returns both shades.
- Regression checklist from §5: every item still passes (they are the first checks of `npm test`). Seed: same 167 takas and same status distribution as baseline (GODOWN 83, MILL 4, DYEING 46, FINISHED 14, FOLDED 10, SOLD 10).
- Browser smoke: dashboard, inventory (reconciliation banner), rack page, mill challan with picking list, shrinkage report, availability page, receipt grid (500-row paste ≈ 1 s, total 49,999.77 exact); no console errors. Found and fixed during this: StrictMode seeded demo data twice (every number doubled) — I-23.
- **Not verified:** Turso/libSQL transaction path (no test DB permitted); paper print output; phone-width visual check; IndexedDB data of an existing real browser profile (use the new backup button before upgrading).
- New issue found while fixing: **I-23 (P0)** double demo seed under React StrictMode — fixed (memoised `ensureSeed`).
