# D13 — Customer Orders + Availability
**Routes:** `/orders`, `/orders/new`, `/orders/:id`
## Build
New order: customer, quality (nick), lines shade + taka count. **Availability panel** for chosen quality: grey @ godown, grey @ mill (shade-free), and per shade: in dyeing, finished, ready. Line shows ✓ / shortfall. Detail can "Allocate ready takas" → SOLD, order_id.
## Checks
Gold Lava order 50 × Shade 38 shows ready/dyeing counts for 38.
## DoD
Availability numbers equal stock views.
