# Dyeing program

**Rules:** R-PG-1..4

## What to do
Issue a program against weaver challans: step 1 mill / date / notes; step 2 cards of one weaver challan each (quality → weaver → challan, tap takas, choose a colour sheet, assigned list, Done / Edit / Remove), summary (right column on desktop, sticky bar on tablet), confirm grouped by quality → challan → colour. "Add more takas" on a program that is not Done. Program detail grouped quality → challan → colour with lots and taka lists; mill-facing PDF with swatch/photo and column-block taka lists.

## What to check
Takas of another mill / another receipt, inactive or unlinked colours and duplicate takas are rejected and a failed save leaves no rows; adding extends the same challan + colour line; a Done program refuses additions; 500 takas within 20 statements; old programs still readable.

## Done when
tests/e2e.mjs "client changes 3" passes in both drivers.

## Status
Done (client changes 3).

## Files touched
src/pages/programs/*, src/components/TakaGrid.jsx, src/db/repo.js, src/db/schema.js
## Round 4: In mill
Folding → *In mill* lists programs with takas still in dyeing by mill and opens Receive from mill in the restricted folding mode (SPEC R-FD-5). The program detail keeps the full receive route.
