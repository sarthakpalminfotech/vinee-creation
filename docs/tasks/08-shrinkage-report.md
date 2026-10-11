# Shrinkage report

**Rules:** R-SH-1..3

## What to do
Per-taka chain and summaries by PO, party, quality, mill, program; direct takas start at mill grey.

## What to check
Open Reports > Shrinkage; check a godown taka: grey - folded = total; a direct taka shows "direct" in weaver column and total = mill grey - folded/finished.

## Done when
Numbers match a hand calculation; PO tab shows ordered vs received shrinkage.

## Status
Done (audit session 1, 2026-10-11). Automated coverage: `npm test`. See `docs/AUDIT.md` for the traceability row.

## Files touched
src/pages/reports/ShrinkagePage.jsx, src/db/repo.js (withLineage, shrinkageReport)
