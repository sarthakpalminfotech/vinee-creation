# Masters

**Rules:** R-M-1..6

## What to do
Party groups with parties, qualities (original + nickname), mills, shop/rack, shade charts + shades with colour, customers. Validation, duplicates blocked, delete blocked when in use.

## What to check
Add group Ganesh + 3 parties; add duplicate rack (case differs) -> error; add shade with colour "red" -> error; delete a mill used by a challan -> error.

## Done when
All masters CRUD with inline errors; duplicates and in-use deletes rejected by `saveMaster/removeMaster`.

## Status
Done (audit session 1, 2026-10-11). Automated coverage: `npm test`. See `docs/AUDIT.md` for the traceability row.

## Files touched
src/pages/masters/MastersPage.jsx, src/db/repo.js (saveMaster, removeMaster)
