# Vinee Creation ERP — Dashboard brief (for the mockup)

**Purpose of this file:** explain the whole system from the owner's seat, so the dashboard mockup can show *everything the system could put on a dashboard*. The client will look at the mockup and tick what he wants. Nothing here is final — it is a menu.

Companion document: `docs/REPORTS-PLAN.md` (the full report list). This file is about the **dashboard** (the one screen the owner opens every morning); each widget points to the report behind it.

Tags used for every widget:

| Tag | Meaning |
|---|---|
| ✅ **Ready** | Data is already recorded; only the screen is needed. |
| 🟡 **Partly** | Can be shown, but one figure is approximate or missing (stated). |
| 🆕 **Needs new entry** | The system does not record it today (e.g. dyeing charges, payments to weavers). |
| ⭐ | Already on today's dashboard / somewhere in the app. |

---

## 1. The business in one paragraph

Vinee Creation is a **textile trader**. It does not weave or dye itself:

1. Buys **grey cloth** from weavers (a **Grey PO**).
2. Weavers deliver it in **takas** (rolls) against a **weaver challan**. It goes to our **godown (branch)** or straight to a **mill**.
3. Grey is sent to a **mill** (mill challan), where it is put into a **dyeing program** with a **colour** per taka.
4. The mill returns **finished** cloth (mill return challan, **lot number**, finished meters).
5. We **fold** it (real folded meters; **damage** noted with photo/voice). This is the **sellable stock**.
6. Some stock goes to a **job worker** (embroidery, printing …) and comes back.
7. Finished cloth is sold against **customer orders** (with a rate per meter), and **payments** are logged. Grey can also be sold directly, or withdrawn (samples, gifts, damage).

Everything is counted in **taka** and **meters** (2 decimals). Money is known only where a rate exists: **PO rate** (buying grey), **order rate** (selling), **grey-sale rate**.

---

## 2. The journey of a taka (the backbone of the system)

```
Grey PO ──► Weaver challan ──► GODOWN_GREY ──► MILL_GREY ──► IN_DYEING ──► FINISHED ──► FOLDED ──► SOLD
 (meters,      (takas, grey      (by branch)    (sent to      (program,     (mill return,  (folded –     (to a customer
  rate)         meters)                          mill)         colour)       finished m)    damage =      order)
                    │                                                                       sellable m)
                    └── direct to mill ──► MILL_GREY                    FOLDED ⇄ JOB_WORK (job worker, returns)
                                                                        FOLDED / GODOWN_GREY → WITHDRAWN (reason, can be cancelled)
                                                                        GODOWN_GREY → GREY_SOLD (direct grey sale)
```

Each taka is in exactly **one stage** at any time, and every move is logged (`taka_moves`). Stages add up to all active takas — so the dashboard can always show "where is all my cloth" and it will reconcile.

**Where cloth is lost (wastage):** only at two places — **at the mill** (grey → finished) and **at folding** (finished → folded) — plus **job work** (sent → received) and **damage** (separate). Nothing is measured between weaver and mill.

---

## 3. Modules and what each one gives the dashboard

| # | Module (menu) | What the user does | Data it records | Dashboard can show |
|---|---|---|---|---|
| 1 | **Masters** | Weaver groups & parties, mills, customers, branches, job workers, qualities (original name + nickname), colour library | Who/what everyone is; customer phone & GSTIN; quality–colour links; last-used date of each colour | Counts, "inactive customers", data-completeness warnings |
| 2 | **Grey PO** | Orders grey meters from a weaver group at a rate | PO no, date, quality, meters, **rate**, due date, status (Open / Partly / Received / Closed short) | Open POs, meters pending, overdue POs, value of grey ordered, short-received |
| 3 | **Grey Challan** (receive) | Records a weaver challan: takas + meters, destination | Challan, party, takas, grey meters, branch or mill | Grey received today/week/month, by weaver/quality, godown vs direct-to-mill |
| 4 | **Mill Dispatch** | Sends takas from godown to a mill (main challan 121 → sub 121A, 121B) | Main/sub challans, mill, takas | Sent to mill (period), grey lying at each mill, open challans |
| 5 | **Dyeing (Programs)** | Issues a program to a mill: picks exact takas + colour per taka | Program, mill, quality, weaver challan, colour, taka count | Programs in progress, takas in dyeing per mill/colour, days at mill |
| 6 | **Mill receipt** (inside a program) | Receives finished cloth back: lot no + finished meters per taka | Mill return challan, lot no, finished meters | Received this period, pending at mill, **mill shortage %** |
| 7 | **Folding** (+ In mill) | Enters folded meters, marks damage | Folded meters, damage meters + photo/voice | To-fold queue, folded today, **folding shortage %**, damage |
| 8 | **Job Work** | Sends folded takas to a job worker, receives back | JW challans, sent/received meters, type, linked order | Pending at job workers, days out, job-work shortage |
| 9 | **Orders** | Customer order: quality, colours, takas/meters, **rate**, payment days | Orders, lines, status, allocation | Open orders, pending to deliver, order value, overdue delivery |
| 10 | **Order payments** | Logs money received against an order (part payments allowed) | Date, amount, mode, ref | Received today/month, **dues, overdue, ageing**, WhatsApp reminders |
| 11 | **Availability** | For a quality × colour: ready, in dyeing, grey at mill/godown, open POs | Derived | Demand vs stock, "what to dye next" |
| 12 | **Inventory** | Live stock by stage, dead stock, damaged stock, sell history, withdrawals, grey sale | Derived + withdrawals + grey sales | Stock by stage, dead stock, damaged stock, sales history |
| 13 | **Shrinkage Report** | Per-taka chain grey → finished → folded; summaries by PO, party, quality, mill, program | Derived | Shortage % overall / by mill / by quality / trend |
| 14 | **Settings** | Payment reminder days, dead-stock days, WhatsApp templates | Rules | Thresholds that drive the alerts |

---

## 4. What the dashboard shows today ⭐

For reference — this is the current screen (`DashboardPage.jsx`):

- "Payments due" red banner (count + amount to collect) → opens overdue orders
- 4 cards: **Open POs** (+ meters pending), **Godown Grey**, **In Dyeing**, **Folded (ready)** — takas + meters
- **Pipeline breakdown** (godown grey, mill grey, in dyeing, finished, ready for sale, at job worker)
- **Shortage analytics** (mill %, folding %, total %)
- **Recent activity** (last 8 events across receipts, dispatches, programs, mill receipts, orders)
- Quick buttons: New PO, Receive Grey

Everything below is **in addition to** this.

---

## 5. Widget menu — what the owner can choose from

Grouped by the question the owner is asking. Suggested visual in brackets. "Drill" = where a tap goes.

### A. Top strip — "How is the business today?"

| # | Widget | Shows | Status | Drill |
|---|---|---|---|---|
| A1 | **Period selector** (Today / Week / Month / Year / Custom) with "vs previous period" | Drives every card below | ✅ | — |
| A2 | **Sales this period** (KPI) | Meters sold, ₹ value (meters × order rate), # orders, Δ vs last period | ✅ | Sales register |
| A3 | **Money received this period** (KPI) | ₹ collected, by mode (NEFT / cheque / cash) | ✅ | Payment register |
| A4 | **Money to collect** (KPI) | Total outstanding ₹, # orders, overdue ₹ | ✅ ⭐ | Overdue list |
| A5 | **Grey bought this period** (KPI) | Meters, ₹ (meters × PO rate) | ✅ | Purchase summary |
| A6 | **Stock value** (KPI) | Grey stock at PO rate; finished at grey rate (true cost needs dyeing rates) | 🟡 | Stock valuation |
| A7 | **Shortage % this period vs last** (KPI) | Total, mill, folding | ✅ ⭐ | Shrinkage report |
| A8 | **Takas in the pipeline** (KPI) | Total active takas + meters, reconciled | ✅ ⭐ | Inventory |

### B. Alerts — "What needs my attention?"

Each is a red/amber count tile; tap opens the list. Thresholds come from Settings.

| # | Alert | Rule | Status |
|---|---|---|---|
| B1 | **Payments overdue** (+ WhatsApp reminder) | Reminder days passed, money still due | ✅ ⭐ |
| B2 | **Programs at mill too long** | Days since issue > N | ✅ |
| B3 | **Grey at mill not yet in a program** | Sent to mill, no program, idle > N days | ✅ |
| B4 | **Takas at job workers too long** | Days out > N | ✅ |
| B5 | **POs past due date** with meters pending | Due date passed | ✅ |
| B6 | **Open orders waiting too long** | Order age > N days | ✅ |
| B7 | **Orders that can be fulfilled now** | Ready stock exists for an open order, not yet allocated | ✅ |
| B8 | **Dead stock** | Idle > dead-stock days (setting) | ✅ ⭐ |
| B9 | **High shortage exception** | A mill receipt / folding above set % | ✅ |
| B10 | **Finished but not folded** | Finished takas waiting to be folded > N days | ✅ |
| B11 | **Data gaps** | Customers without phone (no WhatsApp), orders without rate (no billing), POs without due date, programs without lot no | ✅ |

### C. Money to collect — receivables

| # | Widget | Shows | Visual | Status |
|---|---|---|---|---|
| C1 | **Ageing of dues** | ₹ in buckets: not yet due, 0–30, 31–60, 61–90, 90+ | Stacked bar | ✅ |
| C2 | **Top debtors** | Customers by ₹ due (+ oldest due date) | Ranked bars | ✅ |
| C3 | **Overdue list with WhatsApp** | Customer, phone, order, ₹, days late, one-tap reminder | Table | ✅ |
| C4 | **Collections trend** | ₹ received per day/week/month | Line/column | ✅ |
| C5 | **Expected collections** | Dues by reminder date: this week / next week / this month / later | Column | ✅ |
| C6 | **Customer payment behaviour** | Avg days to pay, % on time | Table | ✅ |
| C7 | **Advance received** | Customers who paid more than billed | List | ✅ |

### D. Sales and customers

| # | Widget | Shows | Visual | Status |
|---|---|---|---|---|
| D1 | **Sales trend** | Meters / ₹ per day/week/month | Line | ✅ |
| D2 | **Top customers** | Meters, ₹, share % | Ranked bars | ✅ |
| D3 | **Top qualities / best-selling colours** | Meters, ₹, # customers | Bars / colour swatches | ✅ |
| D4 | **Open order book** | Orders pending: ordered vs allocated vs pending takas/meters | Table + progress bars | ✅ ⭐ |
| D5 | **Orders by status** | Open / Done / Closed counts | Donut | ✅ |
| D6 | **Order fulfilment time** | Avg days order → first dispatch → complete | KPI | ✅ |
| D7 | **Customers gone quiet** | No order in N days, last order, usual volume | List | ✅ |
| D8 | **Selling rate trend** | Avg rate per meter per quality; orders below minimum | Line | ✅ |
| D9 | **Grey sales** | Direct grey sales: meters, ₹, customers | KPI + list | ✅ |
| D10 | **Job-work orders** | Open job-work orders and linked challans | List | ✅ |

### E. Demand vs stock — "What do I dye / buy next?"

| # | Widget | Shows | Visual | Status |
|---|---|---|---|---|
| E1 | **Shortfall by quality × colour** | Pending order meters vs ready + in dyeing + at job worker → shortfall | Heat-map / table | ✅ ⭐ |
| E2 | **Next dyeing suggestion** | Colours and meters to put in next program, grey needed | List | ✅ |
| E3 | **Ready stock — sellable now** | Folded sellable meters by quality & colour (plain / job-worked) | Colour-swatch grid | ✅ ⭐ |
| E4 | **Open POs vs demand** | Grey still coming vs grey needed | Bars | ✅ |

### F. Stock — "Where is my cloth?"

| # | Widget | Shows | Visual | Status |
|---|---|---|---|---|
| F1 | **Pipeline by stage** | Godown, at mill, in dyeing, finished, folded, job work: takas + meters | Funnel / horizontal stack | ✅ ⭐ |
| F2 | **Godown by branch** | Grey per branch (and per quality) | Bars | ✅ |
| F3 | **Grey at each mill** | Per mill: not programmed vs in dyeing, oldest date | Stacked bars | ✅ |
| F4 | **Dead / slow stock** | Idle takas by stage, ageing buckets, value at grey rate | Bars + table | ✅ ⭐ |
| F5 | **Stock by quality / by colour** | Meters per quality/colour | Treemap / bars | ✅ |
| F6 | **Stock movement** | Opening → in → out → closing for the month | Waterfall | ✅ |
| F7 | **Damaged stock** | Damaged meters, takas, with photo | Count + gallery | ✅ ⭐ |
| F8 | **Withdrawals** | Non-sale stock-outs by reason | Table | ✅ ⭐ |
| F9 | **Stock valuation** | ₹ by stage at grey rate | Column | 🟡 |

### G. Purchase — grey and weavers

| # | Widget | Shows | Visual | Status |
|---|---|---|---|---|
| G1 | **PO status** | Ordered / received / pending meters, % received | Progress bars | ✅ ⭐ |
| G2 | **Overdue POs** | Past due date, pending meters | List | ✅ |
| G3 | **Grey received trend** | Meters per week/month, by weaver | Column | ✅ |
| G4 | **Weaver scorecard** | Meters supplied, on-time %, shrinkage of their cloth at the mill, damage at folding, taka-length check | Table | ✅ |
| G5 | **Short taka length** | Takas below the quality's standard length | List | ✅ |
| G6 | **Purchase rate trend** | Avg PO rate per quality | Line | ✅ |
| G7 | **Short-received** | Ordered − received on closed POs | KPI | ✅ |

### H. Mill and dyeing

| # | Widget | Shows | Visual | Status |
|---|---|---|---|---|
| H1 | **Programs in progress** | Per mill: issued / received / pending takas, days at mill | Table + progress | ✅ ⭐ |
| H2 | **Mill scorecard** | Per mill: meters processed, turnaround days, shrinkage %, damage, pending | Side-by-side table | ✅ |
| H3 | **Turnaround time** | Avg days program → full receipt, by mill | Bars | ✅ |
| H4 | **Colour load** | Takas in dyeing per colour | Swatch bars | ✅ |
| H5 | **Lot lookup** | Search a lot → where its takas are now | Search box | ✅ |
| H6 | **Dyeing charges / mill payable** | Meters × dyeing rate, paid vs pending | KPI | 🆕 |

### I. Wastage — shortage, folding, damage

| # | Widget | Shows | Visual | Status |
|---|---|---|---|---|
| I1 | **Shortage split** | Mill %, folding %, job work %, total | Bars | ✅ ⭐ |
| I2 | **Shortage by mill** | % per mill | Ranked bars | ✅ |
| I3 | **Shortage by quality / weaver** | % per quality, per weaver | Ranked bars | ✅ |
| I4 | **Shortage trend** | Monthly % | Line | ✅ |
| I5 | **High-shortage receipts** | Above set % | List | ✅ |
| I6 | **Damage %** | Damaged ÷ folded meters; by mill/weaver | KPI + bars | ✅ |
| I7 | **Value of wastage** | Shortage meters × grey PO rate | KPI | 🟡 |

### J. Job work

| # | Widget | Shows | Visual | Status |
|---|---|---|---|---|
| J1 | **Pending at job workers** | Per worker: takas, meters, type, days out | Table | ✅ ⭐ |
| J2 | **Job-worker performance** | Avg return days, shortage %, not returned | Table | ✅ |
| J3 | **Job-work status** | Open / Partial / Completed / Closed short | Donut | ✅ |
| J4 | **Job-work charges** | Bill vs paid | KPI | 🆕 |

### K. Profit and payables (needs new entry)

| # | Widget | Shows | Status |
|---|---|---|---|
| K1 | **Margin per quality** | Sales ₹ − grey cost (shortage already included) — *before dyeing / job-work charges* | 🟡 |
| K2 | **Order / customer profit** | Margin of exact takas given, combined with payment delay | 🟡 |
| K3 | **Grey-sale profit** | Sale rate vs PO rate | ✅ |
| K4 | **Monthly P&L** | Sales − purchase − dyeing − job work − wastage − expenses | 🆕 |
| K5 | **Weaver payables** | Grey received × PO rate − payments made | 🆕 |
| K6 | **Mill payables** | Dyeing bills − payments | 🆕 |
| K7 | **Cash-flow outlook** | Expected in (customer dues) vs out (weaver/mill dues), weekly | 🆕 |

### L. Activity and shortcuts

| # | Widget | Shows | Status |
|---|---|---|---|
| L1 | **Recent activity feed** | Latest receipts, dispatches, programs, mill receipts, orders (tap to open) | ✅ ⭐ |
| L2 | **Quick actions** | New PO · Receive grey · Send to mill · New program · Receive from mill · Fold · New order · Log payment · Withdraw | ✅ |
| L3 | **Global search** | Taka / lot / challan / order / customer / PO number | 🆕 (lot & challan search exist per page) |
| L4 | **Today's work list** | Counts: takas to fold, programs to receive, orders to allocate, payments to chase | ✅ |
| L5 | **Audit / data-quality panel** | Reconciliation OK?, data gaps | ✅ |
| L6 | **Who did what** | Entries per staff member | 🆕 (no logins today) |

---

## 6. What the system does NOT record today

These cannot appear on the dashboard until a small entry screen is added. Mock them as "coming" tiles and let the client decide.

- Dyeing / mill charges and mill payments
- Job-work charges
- Payments **made** to weavers
- GST invoices
- Transport and other expenses
- User logins and an activity log (no roles — anyone can do anything)
- Rates at the mill/job-work level, so **true profit** is only "before dyeing/job-work charges" for now

---

## 7. Suggested layouts to mock up

The mockup should offer the client **a choice of dashboard "personalities"**, not just one:

1. **Owner — money & decisions** (default): A (top strip) → B (alerts) → C (collections) → D (sales) → E (what to dye next) → F1 (pipeline).
2. **Operations — floor view**: pipeline by stage, programs at mills, to-fold queue, job work pending, shortage by mill, today's work list.
3. **Accounts — collections view**: C1–C7, payment register, expected collections, customer statement shortcut.
4. **Compact (tablet / phone)**: 4 KPI cards + alert tiles + one chart + recent activity. Tablet is the main device, so tiles must be ≥ 44 px, no sideways scroll, takas and meters together.

Common behaviours to show in the mockup:
- **Period filter** (+ compare with previous period) at the top.
- **Every number is tappable** and opens the list behind it (customer → orders → dispatches → takas).
- **Filters** where it helps: customer, weaver, mill, quality, colour, branch.
- **Export / share**: PDF, Excel, WhatsApp summary.
- **Customisable**: the owner can show / hide / reorder widgets and save a view.
- **Takas + meters together** everywhere; ₹ only where a rate exists.

---

## 8. Questions to ask the client

1. Who opens the dashboard — only the owner, or also staff? (decides whether we make one or several layouts)
2. Which 6–8 numbers do you want to see **first thing in the morning**?
3. Which **alerts** matter, and what are the day limits? (programs at mill, job work out, dead stock, overdue POs)
4. Do you want **₹ values** on the dashboard (sales, dues, stock value)? Should any be hidden from staff?
5. Are **dyeing rates** and **payments to weavers/mills** worth recording to unlock profit and payables?
6. Compare periods **week-on-week or month-on-month**?
7. Do you want **colour-wise** views (swatches) or only quality-wise?
8. Should the dashboard be **printable / sharable on WhatsApp** as a daily summary?
9. Do you need **per-branch** views (godown stock per branch)?
10. Is a **login with roles** wanted (owner sees money, staff see work)?

---

## 9. Where the data comes from (for the build)

All data is read through `src/db/repo.js`. Existing functions the dashboard can reuse: `dashboard()`, `inventoryCounts()`, `godownByBranch()`, `deadStock()`, `damagedStock()`, `availability()` / `availabilityDetail()`, `orderAvailability()`, `inMillPrograms()`, `shrinkageReport()`, `listOrders()` (with `payment` info: due, outstanding, due date), `listPOs()`, `listPrograms()`, `listJobWorks()`, `sellHistory()`, `listWithdrawals()`, `listGreySales()`. New aggregate queries needed for the period KPIs, ageing buckets, top-customer / top-quality ranking, weaver and mill scorecards, and trends — all derivable from existing tables (no schema change) except the 🆕 items in section 6.
