# D02 — Create Grey PO
**Route:** `/po/new`
## Build
Fields: PO no (auto `PO-0001`, editable — paper PO no), date, weaver **group**, quality, meters, rate/m, taka length (from quality), due date, notes, photo of paper PO (Cloudinary).
Live summary card: amount = meters × rate, expected takas = meters / taka length.
## Checks
50,000 m @ 3.50 → ₹1,75,000, ~500 takas. Save → redirected to PO detail.
## DoD
Validation (group, quality, meters>0, rate>0). Saved PO shows in list with status OPEN.
