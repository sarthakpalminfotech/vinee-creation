# Progress log

## Session 1 (audit) — 2026-10-11
Branch `audit-fixes` (baseline commit "Baseline before audit" on `master`). One commit per fix group.

Done: Phase A (`docs/AUDIT.md`); P0 (transactions, state machine + history, server-side validation for receipt/dispatch/program/mill receipt/folding, PO statuses, seed double-insert under StrictMode, remote-DB safety); P1 (rack assignment page, picking list + printable challan, program split/PDF, folding, inventory (4 views + reconciliation), availability, shrinkage report); P2 (inline errors, no double submit, pagination, masters validation); docs.
Verified: `npm test` (56 checks incl. the §4 scenario), `npm run build`, browser smoke of dashboard/inventory/assignment/dispatch/shrinkage/receipt grid (500-row paste in ≈1 s, total exact).

Not verified (and why): Turso code path (`tx()` on libSQL) — no test database allowed; printing output on paper (only on-screen layout checked); phone-width layouts only checked via CSS review; mill-facing PDFs are browser print, not generated files.

Next / for the owner: delete `test-db.js` and rotate its Turso token; answer the open questions in `docs/SPEC.md`; add `vercel.json` SPA rewrite before deploying; consider moving DB calls behind an API before production (token is in the browser bundle).
