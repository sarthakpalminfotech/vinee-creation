# 13 · Grey direct sell and sell history
Goal: sell grey at our place directly to a customer; list closed orders and grey sales.
Build: `createGreySale`, `getGreySale`, `listGreySales`, `greyGodownTakas`, `sellHistory`; pages `withdraw/GreySellForm`, `GreySaleDetailPage` (timeline), `GreySaleDocs` (PDF); Inventory *Sell history* mode.
Checks: tests "Grey direct sell", "Sell history".
DoD: R-GS-1, R-INV. Cancelling a grey sale is an open question (not built).

Click-through checklist (no white screen, no console errors): every Inventory tile, stage, mode and detail page (godown, mill, dyeing, finished, jobwork, dead, damaged), with and without filters.
