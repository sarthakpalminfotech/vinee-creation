# Grey receipt

**Rules:** R-GR-1..4

## What to do
Receipt against PO from a party of the PO group; destination godown or direct to mill; keyboard grid, Excel paste, running totals, duplicates and >2 decimals blocked; one transaction.

## What to check
New receipt, paste 500 meters into a meter cell -> 500 rows, total exact; duplicate taka no -> highlighted and save blocked; direct to mill -> takas appear in Grey at mill only.

## Done when
Hundreds of rows entered quickly; exact meters; server rejects wrong group, missing mill, closed PO, duplicates.

## Status
Done (audit session 1, 2026-10-11). Automated coverage: `npm test`. See `docs/AUDIT.md` for the traceability row.

## Files touched
src/pages/receipts/*, src/db/repo.js (createReceipt)
