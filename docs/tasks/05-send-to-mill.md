# Send to mill (main + sub-challans)

**Rules:** R-SM-1..6

## What to do
New mill challan screen: header (mill, date, main no, notes) + stack of weaver-challan part cards (picker, read-only party, quality, takas grid with Select all / First N / Clear), summary column (desktop) or sticky bar (tablet), confirm popup, one transaction. Detail: sub-challans, print full or one sub, add another weaver challan, close / reopen. PDF: cover + one page per sub.

## What to check
Two weaver challans in one save give main 1 with 1A, 1B; adding gives 1C; a weaver challan already in the main extends its sub; closed main refuses; wrong-challan takas and double sends are rejected and leave no rows.

## Done when
All checks in tests/e2e.mjs (section 5) pass; old challans open as "Old challan".

## Status
Done (client changes 1).

## Files touched
src/pages/dispatch/*, src/db/repo.js, src/components/DocPreview.jsx
