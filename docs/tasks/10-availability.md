# Availability

**Rules:** R-SO-1

## What to do
Choose the quality first, then its colours. The panel starts with "Open POs: N · Pending: X m" (Open + Partly received POs of the quality, link to the PO list filtered by quality), then per-colour stock (sellable meters), grey at mill, grey at our place by branch.

## What to check
Closed (short) and fully received POs are excluded from the block.

## Done when
availabilityDetail().openPos is covered in tests/e2e.mjs.

## Status
Done (client changes 1).

## Files touched
src/pages/orders/AvailabilityPanel.jsx, AvailabilityPage.jsx, CreateOrderPage.jsx, src/db/repo.js

**Client changes 2:** per colour, finished goods are split into plain and job-worked (with job types) plus "At job worker"; a job-work order shows the job-worked stock first.
## Round 4: stock on the order detail
`/orders/:id` shows "Available stock" (SPEC R-SO-5): per line ready plain / job-worked (eligible highlighted), to fold, in dyeing with lots, at job worker; once per quality grey and open POs; "Short by" / "Covered"; *Allocate now* button. Right column at ≥ 1280 px.
