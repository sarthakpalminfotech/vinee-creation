# D04 — Receive Grey Challan (bulk taka entry)
**Route:** `/receipts/new?po=:id`, list `/receipts`, detail `/receipts/:id`
## Build
- Pick PO (only open/partial) → firm limited to the PO's group.
- Challan no, date, **destination**: Godown or Direct to Mill (+ mill).
- Taka entry: (a) **Paste** box: meters separated by space/newline/comma → rows; (b) grid with auto taka no (start no editable), Enter jumps to next row; remove row.
- Live totals: takas, meters, avg, min/max, vs nominal. Highlight outliers (<94 or >106).
- Optional challan photo. Optional "assign location now" for godown receipts.
- Takas created with status GODOWN_GREY or MILL_GREY (+mill_id).
## Checks
Paste `96.5 102.58 94.69 103.5` → 4 rows total 397.27 m. PO progress updates.
## DoD
Receipt detail lists takas with status & location.
