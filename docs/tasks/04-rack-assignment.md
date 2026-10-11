# Rack assignment

**Rules:** R-LOC-1..3

## What to do
Bulk select (all/range/N) grey takas in godown and assign or move to a rack; history kept; stock by shop -> rack.

## What to check
Select 24 unassigned takas -> Rack-A; move one to Rack-B and back -> history shows 4 entries; location tree totals equal rows.

## Done when
Only GODOWN_GREY takas can be racked (server-side); history in `taka_moves`.

## Status
Done (audit session 1, 2026-10-11). Automated coverage: `npm test`. See `docs/AUDIT.md` for the traceability row.

## Files touched
src/pages/assignment/LocationAssignmentPage.jsx, src/db/repo.js (assignLocation, getTakaHistory, groupPickList)
