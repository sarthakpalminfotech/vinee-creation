# Send to mill

**Rules:** R-SM-1..5

## What to do
Choose takas (filter by received challan), picking list grouped by rack on screen and print, challan shows nickname, takas leave godown; atomic, no double send.

## What to check
Send 36 of 48 -> picking list Rack-A 24 / Rack-B 12; challan prints Gold Lava; 12 remain; sending a sent taka again -> error and nothing changes.

## Done when
All of the above; print shows only the document.

## Status
Done (audit session 1, 2026-10-11). Automated coverage: `npm test`. See `docs/AUDIT.md` for the traceability row.

## Files touched
src/pages/dispatch/*, src/db/repo.js (createDispatch, getPickList)
