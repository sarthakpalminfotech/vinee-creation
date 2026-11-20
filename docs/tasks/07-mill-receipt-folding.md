# Mill receipt and folding

**Rules:** R-FR-1..4, R-FD-1..4

## What to do
Mill receipt by weaver challan: return challan no / date / notes / photo, then cards per weaver challan with, per colour, a lot no (locked once set), a tap grid of pending takas and a finished-meters input per selected taka (Enter = next, Paste = one meter per line); confirm per challan and colour with grey, finished and shortage. Folding: all pending takas of an opened challan are preselected, per-row Damage, confirm popup; lots shown per taka and per challan card and searchable.

## What to check
A lot is required on every received line; a different lot for a line that already has one is rejected, the same lot is accepted; takas carry `lot_no`; pending per line and colour is right; the program is Done after the last receipt; an old-style program can be received with one lot per line.

## Done when
tests/e2e.mjs "client changes 3" and sections 7–10 and 18 pass in both drivers.

## Status
Done (client changes 3). Not verified in automation: microphone recording, Cloudinary upload.

## Files touched
src/pages/folding/*, src/pages/programs/ReceiveProgramPage.jsx, src/components/DamageDetails.jsx, src/db/repo.js
## Round 4: receive in 3 steps
Mill challan → takas + lot per shade (no meters) → finished meters one lot card at a time → confirm (SPEC R-FR). Lines sharing a lot text share a card. After a save from Folding → In mill, *Fold these takas now* opens `/folding?open=<receipt id>`.
