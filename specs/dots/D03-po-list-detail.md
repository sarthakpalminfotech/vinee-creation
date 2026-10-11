# D03 — PO List & Detail
**Routes:** `/po`, `/po/:id`
## Build
- List: filters (status, group, quality, search), progress bar received/ordered, status badge.
- Detail: header facts, progress ring, receipts list (challan, firm, takas, meters, destination), weaver shrinkage at PO level (ordered − received), "Receive Challan" button, "Close PO" (mark complete short).
## Checks
PO with 2 partial receipts shows PARTIAL and sums correctly. Close → COMPLETED.
## DoD
Mobile cards / desktop table; numbers match receipts.
