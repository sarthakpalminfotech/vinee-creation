# Grey PO

**Rules:** R-PO-1..4

## What to do
PO per party group with manual PO number; statuses Open / Partly received / Received / Closed (short); shrinkage (ordered - received, m and %); close short freezes receipts, re-open possible.

## What to check
Create PO 50,000 m @ 3.50 (number typed); receive 49,300 m; close short -> status Closed (short), shortfall 700 m (1.4 %); try receiving -> refused.

## Done when
Statuses and shrinkage correct on list and detail; duplicate PO numbers rejected.

## Status
Done (audit session 1, 2026-10-11). Automated coverage: `npm test`. See `docs/AUDIT.md` for the traceability row.

## Files touched
src/pages/po/*, src/db/repo.js (decoratePo, createPO, setPOClosed)
