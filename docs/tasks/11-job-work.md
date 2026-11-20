# 11 · Job work
Goal: send plain FOLDED goods to a job worker, receive them back, keep them apart from plain stock.
Build: `createJobWork`, `receiveJobWork`, `closeJobWork`, `reopenJobWork`, `linkJobWorkOrder`, `listJobWorks`, `getJobWork` in repo.js; pages in `src/pages/jobwork/`; masters tab *Job workers*.
Checks: tests/e2e.mjs "client changes 2" (JW-1..3, close/reopen, orders, batching ≤ 20 statements for 300 takas).
DoD: rules R-JW-1..6 and R-SO-3 in docs/SPEC.md hold; reconciliation holds after every step.
