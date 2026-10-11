# Mill receipt and folding

**Rules:** R-FR-1..4, R-FD-1..3

## What to do
Receive finished takas against a program with grey + finished meters (partial allowed, never twice); folding with real folded meters; losses shown.

## What to check
Receive 30 of 48 -> pending per shade shown; receive same taka again -> error; fold 10 with corrected meters -> folding loss shown.

## Done when
State checks server-side; finishing and folding shrinkage per taka and total.

## Status
Done (audit session 1, 2026-10-11). Automated coverage: `npm test`. See `docs/AUDIT.md` for the traceability row.

## Files touched
src/pages/programs/ReceiveProgramPage.jsx, src/pages/folding/FoldingPage.jsx, src/db/repo.js (createFinishedReceipt, foldTakas)
