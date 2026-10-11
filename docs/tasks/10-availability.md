# Customer availability and orders

**Rules:** R-SO-1..2

## What to do
Availability by quality nickname and shade (finished, in dyeing with program/mill, grey at mill, grey at our place) on its own page and on the order form; orders list/detail.

## What to check
Availability for Gold Lava shades 37 + 39 shows all four sections; create an order and see needs vs stock.

## Done when
Panel correct; booking/reservation left as an open question.

## Status
Done (audit session 1, 2026-10-11). Automated coverage: `npm test`. See `docs/AUDIT.md` for the traceability row.

## Files touched
src/pages/orders/*, src/db/repo.js (availabilityDetail)
