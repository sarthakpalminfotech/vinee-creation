# Inventory

**Rules:** R-INV (SPEC Inventory)

## What to do
Four views; grey at our place by branch only; finished goods in sellable meters with a "Damaged" filter and damage tags / details.

## What to check
Views reconcile; no rack column or filter.

## Done when
inventoryCounts().reconciled stays true after folding with damage and after allocation.

## Status
Done (client changes 1).

## Files touched
src/pages/inventory/*, src/db/repo.js

**Client changes 2:** fifth stage tile *FG in job work* (`/inventory/jobwork/:qualityId`), plain / job-worked filter on finished goods, job-worked chips on finished cards, Withdraw chooser, Sell history and Withdrawals modes. Reconciliation: godown + mill + dyeing + finished + job work = all active takas.
## Round 4: Sell to order
Withdraw chooser → Finished goods → *Sell to order* (`/inventory/withdraw/fg-order`). Pick an open order (search, customer / quality filters, `?order=`), adjust takas / meters per line, preview the picked takas, confirm in one transaction, success screen with *Open order* / *Back to inventory*. Rule: SPEC R-SO-4.
