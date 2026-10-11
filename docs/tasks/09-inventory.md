# Inventory

**Rules:** sec 2.10

## What to do
Four stock views with filters and a reconciliation banner.

## What to check
Open Inventory: the four counts add up to active takas; filter by quality / party group / party / mill / shade / rack.

## Done when
Totals equal the sum of rows; reconciliation banner green.

## Status
Done (audit session 1, 2026-10-11). Automated coverage: `npm test`. See `docs/AUDIT.md` for the traceability row.

## Files touched
src/pages/inventory/InventoryPage.jsx, src/db/repo.js (inventoryCounts, inventoryList)
