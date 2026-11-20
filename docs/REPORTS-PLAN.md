# Vinee Creations ERP — Reports module: what the owner can get

A list of every report this system can give, written from the owner's side: **what question it answers**, what it shows,
and how it would be filtered. Each report is tagged with whether the data is already being recorded today.

| Tag | Meaning |
|---|---|
| ✅ **Ready** | Everything needed is already entered in the system — the report only needs a screen. |
| 🟡 **Partly** | Can be built now, but one figure is missing or approximate (noted in the report). |
| 🆕 **Needs new entry** | The system does not record this yet; a small new entry screen / field is required first. |
| ⭐ | Already partly visible somewhere in the app today (Dashboard, Inventory, Shrinkage report …) — the report module would make it complete, filterable and exportable. |

**What the system records today:** grey POs (with rate per meter), weaver challans and every taka with its grey meters,
godown branches, mill challans, dyeing programs (colours, lots), mill receipts (finished meters), folding (folded meters,
damage with photo/voice), job work (sent / received meters), withdrawals, grey sales (with rate), customer orders (with
rate per meter), allocation and dispatch of takas to orders, customer payments, and the full movement history of every taka.

**Not recorded today:** dyeing / mill charges, job work charges, payments made to weavers and mills, GST invoices,
transport / other expenses. Reports that depend on these are marked 🆕.

---

## Contents
1. [Owner's daily snapshot](#1-owners-daily-snapshot)
2. [Money to collect (receivables)](#2-money-to-collect-receivables)
3. [Sales and customers](#3-sales-and-customers)
4. [Purchase — grey cloth and weavers](#4-purchase--grey-cloth-and-weavers)
5. [Mill and dyeing](#5-mill-and-dyeing)
6. [Shortage, folding and damage (wastage)](#6-shortage-folding-and-damage-wastage)
7. [Job work](#7-job-work)
8. [Stock](#8-stock)
9. [Profitability](#9-profitability)
10. [Money to pay (payables)](#10-money-to-pay-payables)
11. [Control and audit](#11-control-and-audit)
12. [Recommended first phase](#12-recommended-first-phase)
13. [Features every report should have](#13-features-every-report-should-have)

---

## 1. Owner's daily snapshot

### 1.1 Business summary (today / this week / this month) — ✅ ⭐
**Owner's question:** *"How is the business doing right now, in one screen?"*
- Grey received (takas, meters, ₹ at PO rate), sent to mill, received back finished, folded, dispatched to customers
- Orders taken (count, meters, ₹ value), dispatched value (₹ billable), payments received (₹)
- Total payment due today and how many orders are overdue
- Stock in each stage (godown, at mill, in dyeing, finished, at job worker)
- Shortage % this period vs last period
- **Filters:** period (today, this week, this month, custom); compare with the previous period.

### 1.2 Alerts / action list — ✅
**Owner's question:** *"What needs my attention today?"*
- Payments overdue (with WhatsApp reminder button)
- Programs at the mill for more than N days
- Grey lying at the mill not yet put into a program
- Takas at job workers for more than N days
- Open orders older than N days, and orders whose colours are in ready stock but not yet allocated
- Dead stock crossing the dead-stock days
- POs past their due date with meters still pending
- Unusually high shortage on a mill receipt or folding (above a set %)

---

## 2. Money to collect (receivables)

### 2.1 Outstanding payments — customer wise — ✅ ⭐
**Owner's question:** *"Who owes me money and how much?"*
- Per customer: billed (dispatched meters × rate), received, **current due**, advance (if paid extra), number of orders, oldest due date
- Click a customer → order-wise breakup
- **Filters:** customer, city, only overdue, amount above ₹X.

### 2.2 Ageing of dues — ✅
**Owner's question:** *"How old is the money stuck in the market?"*
- Due amount split into buckets: not yet due, 0–30, 31–60, 61–90, 90+ days late
- Per customer and grand total; chart of total due by bucket
- **Filters:** customer, city, quality.

### 2.3 Overdue list with WhatsApp — ✅
**Owner's question:** *"Whom should my staff call or message today?"*
- Orders whose reminder date has passed and money is still due: customer, phone, order, due amount, days late
- One-tap WhatsApp reminder per row (uses the message templates)
- **Filters:** days late more than N, customer.

### 2.4 Payment collection register — ✅
**Owner's question:** *"How much money came in, and how?"*
- Every payment logged: date, customer, order, amount, mode (NEFT / cheque / cash), reference
- Totals per day / week / month and per mode
- **Filters:** date range, customer, mode.

### 2.5 Customer statement (ledger) — ✅
**Owner's question:** *"Send the customer their account — what was dispatched, what they paid, what is left."*
- Running statement for one customer: dispatches (date, order, meters, ₹) and payments, with running balance
- Printable / PDF / share on WhatsApp
- **Filters:** customer, date range.

### 2.6 Expected collections — ✅
**Owner's question:** *"How much money should come in over the next weeks?"*
- Dues by their reminder date: this week, next week, this month, later
- **Filters:** customer, period.

### 2.7 Payment behaviour of customers — ✅
**Owner's question:** *"Which customers pay on time and which delay?"*
- Per customer: average days from dispatch to payment, % paid on time, longest delay, current due
- Helps decide credit limits and rates for each customer.

---

## 3. Sales and customers

### 3.1 Sales register (dispatches) — ✅ ⭐ (Sell history)
**Owner's question:** *"What did we sell and to whom?"*
- Every dispatch to an order: date, customer, order, quality, colour, takas, meters, rate, ₹ value
- Grey sales shown in the same register (marked "Grey sale")
- Totals per day / month
- **Filters:** date range, customer, quality, colour, plain / job-worked.

### 3.2 Customer-wise sales — ✅
**Owner's question:** *"Who are my biggest customers?"*
- Per customer: meters bought, ₹ value, number of orders, average rate, last order date
- Ranked; share of total sales (%)
- **Filters:** period, city, quality.

### 3.3 Quality-wise and colour-wise sales — ✅
**Owner's question:** *"Which qualities and colours sell the most?"*
- Per quality and per colour: meters sold, ₹ value, number of customers, average rate
- Top 10 colours per quality; colours that stopped selling
- **Filters:** period, customer, city.

### 3.4 Order book (open orders) — ✅ ⭐
**Owner's question:** *"What orders are pending and how much is still to give?"*
- Per open order: customer, quality, ordered (takas / meters), allocated, dispatched, pending, days since order
- Colour-wise pending lines
- **Filters:** customer, quality, older than N days, job-work orders only.

### 3.5 Order fulfilment and delays — ✅
**Owner's question:** *"Are we delivering on time?"*
- Days from order to first dispatch and to full completion, per order / customer / quality
- Orders open longer than N days, with the reason (no stock, at mill, at job worker)

### 3.6 Demand vs stock (what to dye next) — ✅ ⭐ (Availability)
**Owner's question:** *"Which colours are customers asking for that I don't have ready?"*
- Per quality × colour: pending order meters vs ready stock vs in dyeing vs at job worker → **shortfall**
- Suggests what to put in the next dyeing program and how much grey is needed
- **Filters:** quality, colour.

### 3.7 Customer activity — ✅
**Owner's question:** *"Which customers have gone quiet?"*
- Customers with no order in the last N days, with their last order date and usual monthly volume
- New customers in the period.

### 3.8 Rate analysis (selling) — ✅
**Owner's question:** *"Am I getting the right rate?"*
- Rate per meter by quality over time; per customer; lowest / highest / average
- Orders below a set minimum rate.

---

## 4. Purchase — grey cloth and weavers

### 4.1 PO status — ✅ ⭐
**Owner's question:** *"How much grey have I ordered and how much has come?"*
- Per PO: firm, quality, ordered meters, received meters, pending meters, % received, due date, overdue
- **Filters:** firm, quality, open / closed, overdue only.

### 4.2 Grey receipt register (weaver challans) — ✅
**Owner's question:** *"What grey came in, from whom, and where did it go?"*
- Every challan: date, challan no, PO, associated party, destination (godown branch / mill), takas, meters, ₹ at PO rate
- Totals per day / month / firm
- **Filters:** date range, firm, associated party, quality, branch, destination.

### 4.3 Weaver / firm performance — ✅
**Owner's question:** *"Which weavers are reliable?"*
- Per firm and associated party: meters supplied, on-time vs late against PO due date, average taka length vs the quality's standard, **shrinkage of their cloth at the mill**, damage found at folding
- Ranks weavers by quality of cloth, not only quantity.

### 4.4 Purchase summary — ✅
**Owner's question:** *"How much grey did I buy, and at what cost?"*
- Meters and ₹ (meters × PO rate) per month, per quality, per firm; average purchase rate trend.

### 4.5 Taka length check — ✅
**Owner's question:** *"Are weavers sending short takas?"*
- Takas below the expected taka length, per challan / weaver, with total meters short.

---

## 5. Mill and dyeing

### 5.1 Stock at mill (grey not yet in a program) — ✅ ⭐
**Owner's question:** *"How much of my grey is lying at each mill unused?"*
- Per mill: takas and meters sent but not programmed, oldest date, days lying
- **Filters:** mill, quality, older than N days.

### 5.2 Programs pending at mill — ✅ ⭐ (In mill)
**Owner's question:** *"What is the mill still to give back?"*
- Per program: mill, date, quality, colours, takas issued / received / pending, days at mill, lots
- **Filters:** mill, quality, colour, older than N days.

### 5.3 Mill turnaround time — ✅
**Owner's question:** *"Which mill is fastest / slowest?"*
- Average days from program to first and to full receipt, per mill and per quality / colour
- Programs that took longer than N days.

### 5.4 Mill performance scorecard — ✅
**Owner's question:** *"Which mill should get my next program?"*
- Per mill: meters processed, average turnaround, **average shrinkage %**, damage found at folding, programs pending
- Side-by-side comparison of mills.

### 5.5 Dyeing program register — ✅
**Owner's question:** *"What did we send for dyeing and what came back?"*
- Every program and every mill receipt: grey meters, finished meters, lot numbers
- **Filters:** date range, mill, quality, colour, lot.

### 5.6 Lot register / lot traceability — ✅
**Owner's question:** *"Where are all the takas of lot L-778?"*
- Per lot: mill, program, colour, takas, where each taka is now (finished, folded, sold to which customer, at job worker).

### 5.7 Dyeing charges — 🆕
**Owner's question:** *"How much do I pay each mill?"*
- Mill bill per program / per month (meters × dyeing rate), paid vs pending
- **Needs:** dyeing rate per mill (per quality / colour) and mill bill / payment entry.

---

## 6. Shortage, folding and damage (wastage)

### 6.1 Shrinkage / shortage report — ✅ ⭐ (Shrinkage report)
**Owner's question:** *"How much cloth am I losing, and where?"*
- Shortage at the mill (grey → finished), at folding (finished → folded), at job work (sent → received), total
- Per mill, quality, colour, weaver, program, period — in meters and %
- Taka-level detail on click.

### 6.2 Shortage trend — ✅
**Owner's question:** *"Is wastage getting better or worse?"*
- Monthly shortage % per mill / quality; highlights months above the normal level.

### 6.3 High-shortage exceptions — ✅
**Owner's question:** *"Which receipts or takas lost much more than normal?"*
- Mill receipts and takas with shortage above a set % (e.g. above 10 %), for follow-up with the mill.

### 6.4 Damage report — ✅ ⭐ (Damaged stock)
**Owner's question:** *"How much damaged cloth do I have and who caused it?"*
- Damaged takas: meters damaged, quality, colour, mill, weaver, with photo / voice note
- Totals per mill, weaver, quality; damage % of folded meters.

### 6.5 Folding register — ✅
**Owner's question:** *"How much was folded and how much is still to fold?"*
- Folded takas per day (meters, shortage), pending to fold per mill challan.

### 6.6 Value of wastage — 🟡
**Owner's question:** *"What does the shortage cost me in rupees?"*
- Shortage meters × grey PO rate (available now); adding dyeing cost needs dyeing rates (🆕).

---

## 7. Job work

### 7.1 Pending at job workers — ✅ ⭐
**Owner's question:** *"What is lying with each job worker, and since when?"*
- Per job worker: challans, takas, meters, job type, days out, linked order
- **Filters:** job worker, job type, older than N days.

### 7.2 Job work register — ✅
- Every job work challan and receipt: sent meters, received meters, shortage, not returned.

### 7.3 Job worker performance — ✅
**Owner's question:** *"Which job worker is fast and careful?"*
- Per job worker: average days to return, shortage %, takas not returned.

### 7.4 Job work charges — 🆕
- Bill per challan (meters / pieces × rate), paid vs pending.
- **Needs:** job work rate and payment entry.

---

## 8. Stock

### 8.1 Stock summary by stage — ✅ ⭐ (Inventory)
**Owner's question:** *"Where is all my cloth right now?"*
- Grey at godown (per branch), grey at mill, in dyeing, finished (to fold / folded), at job worker — takas and meters
- Reconciliation check (all stages add up).

### 8.2 Ready stock — quality × colour — ✅ ⭐
**Owner's question:** *"What can I sell today?"*
- Folded, sellable meters per quality and colour (plain / job-worked), with lot numbers
- Printable stock list to share with customers / agents on WhatsApp.

### 8.3 Godown stock — branch wise — ✅ ⭐
- Grey per branch, per quality, per firm; oldest taka date.

### 8.4 Dead stock / slow-moving stock — ✅ ⭐ (Dead stock)
**Owner's question:** *"What cloth is not moving and blocking my money?"*
- Takas idle longer than N days, per stage, quality, colour; idle days; value at grey rate
- Ageing buckets: 0–30, 31–60, 61–90, 90+ days.

### 8.5 Stock movement (opening → in → out → closing) — ✅
**Owner's question:** *"For this month, what came in and what went out?"*
- Per stage and quality: opening stock, received, moved out (to next stage / sold / withdrawn / wasted), closing stock
- Built from the taka movement history.

### 8.6 Stock valuation — 🟡
**Owner's question:** *"How much money is sitting in stock?"*
- Grey stock at PO rate (available now); finished stock at grey rate (available) or at cost including dyeing (needs dyeing rates 🆕) or at expected selling rate.

### 8.7 Taka history (traceability) — ✅
**Owner's question:** *"Show me the full life of this taka."*
- From weaver challan → godown → mill → program → finished → folded → job work → order / sale, with dates and meters at each step.

### 8.8 Withdrawals register — ✅ ⭐
**Owner's question:** *"What stock was taken out other than sales?"*
- Every withdrawal (grey / finished, reason, takas, meters), cancellations.

---

## 9. Profitability

### 9.1 Gross margin per quality — 🟡
**Owner's question:** *"Which quality makes me the most money?"*
- Selling value (meters sold × order rate) vs grey cost (grey meters used × PO rate, which already includes the shrinkage)
- **Missing today:** dyeing and job work charges — the report would show "margin before dyeing / job work" until those rates are recorded (🆕).

### 9.2 Order-wise profit — 🟡
- Per order: sales value vs grey cost of the exact takas given (traceable taka by taka); dyeing cost when available.

### 9.3 Customer-wise profit — 🟡
**Owner's question:** *"Which customers are actually profitable after discounts and delays?"*
- Margin per customer, combined with their payment delay (money blocked).

### 9.4 Grey sale profit — ✅
- Grey sold directly: sale rate vs PO rate × meters.

### 9.5 Monthly P&L view — 🆕
- Sales, grey purchase, dyeing, job work, wastage, other expenses → gross profit per month.
- **Needs:** expense entries (dyeing, job work, transport, other).

---

## 10. Money to pay (payables)

### 10.1 Weaver payables — 🆕
**Owner's question:** *"How much do I owe each weaver, and when?"*
- Grey received × PO rate (already known) minus payments made to the weaver (**not recorded today**)
- Ageing of what is owed; due-date list.

### 10.2 Mill payables — 🆕
- Dyeing bills minus payments made (needs dyeing rates + mill payment entry).

### 10.3 Cash flow view — 🆕
- Expected money in (customer dues by date) vs money out (weaver / mill dues by date), week by week.

---

## 11. Control and audit

### 11.1 Stock reconciliation — ✅ ⭐
- Every active taka is in exactly one stage; any mismatch listed.

### 11.2 Edits and deletions log — 🆕
**Owner's question:** *"Who changed what?"*
- Changes to POs, challans, orders, payments, masters: who, when, old → new.
- **Needs:** user logins and an activity log.

### 11.3 Data completeness — ✅
- Customers without phone numbers (WhatsApp reminders won't have a number), orders without a rate (no billing / dues), POs without due date, takas without branch, programs without lot numbers.

### 11.4 User activity — 🆕
- Entries made per staff member per day (needs user logins).

---

## 12. Recommended first phase

Ten reports with the most value for the owner that can be built on the data already in the system (all ✅):

| # | Report | Why first |
|---|---|---|
| 1 | Business summary (1.1) | One screen for the owner every morning |
| 2 | Outstanding payments + ageing (2.1, 2.2) | Money stuck in the market |
| 3 | Overdue list with WhatsApp (2.3) | Turns the report into action |
| 4 | Customer statement (2.5) | Asked for by every customer; shareable PDF |
| 5 | Sales register + customer / quality / colour-wise sales (3.1–3.3) | What sells and to whom |
| 6 | Order book (3.4) | What is still to deliver |
| 7 | Demand vs stock — what to dye next (3.6) | Plans the next dyeing program |
| 8 | Mill performance scorecard (5.4) | Decides which mill gets the next program |
| 9 | Shrinkage report + trend (6.1, 6.2) | Biggest hidden loss in the business |
| 10 | Dead stock + stock valuation at grey rate (8.4, 8.6) | Money blocked in stock |

**Second phase (needs small new entries):** dyeing rates + mill bills/payments, weaver payments, job work rates,
expenses → unlocks true profitability (9.x), payables (10.x) and the monthly P&L. User logins → audit log (11.2).

---

## 13. Features every report should have

- **Period filter** with quick picks (today, this week, this month, last month, this year, custom) and **comparison with the previous period**.
- **Common filters:** customer, firm / weaver, mill, job worker, quality, colour, branch, lot.
- **Drill-down:** every total opens the rows behind it (e.g. customer → orders → dispatches → takas).
- **Export:** Excel (for the accountant) and PDF (for printing / sharing).
- **Share on WhatsApp:** PDF or a short text summary (same idea as the payment reminders).
- **Tablet-friendly:** summary cards on top, chart in the middle, table below; tables fit the screen without sideways scrolling.
- **Saved views:** the owner's favourite filter combinations, one tap away.
- **Takas and meters together** everywhere (as in the rest of the app), and ₹ where a rate is known.
