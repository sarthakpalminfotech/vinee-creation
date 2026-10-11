# Mill program

**Rules:** R-PG-1..4

## What to do
Program for mill + quality + chart; total check; shades split adds up; only grey at that mill; PDF shows shade colours, takas and meters.

## What to check
Program 48 takas: 24 x 37 + 24 x 39 -> PDF swatches; asking for more than available -> error; split not equal to total -> blocked.

## Done when
Takas move to IN_DYEING atomically; duplicate shade lines blocked.

## Status
Done (audit session 1, 2026-10-11). Automated coverage: `npm test`. See `docs/AUDIT.md` for the traceability row.

## Files touched
src/pages/programs/CreateProgramPage.jsx, ProgramDetailPage.jsx, src/db/repo.js (createProgram)
