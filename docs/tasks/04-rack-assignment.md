# Rack assignment

**Rules:** R-LOC-1..3 (retired)

## What to do
Retired by the client: grey is tracked by branch only. No rack field, picking list, rack filter or Rack/Godown page. /assignment redirects to /inventory.

## What to check
Nothing in the screens mentions racks; receipts ignore location_id; new takas have no location.

## Done when
assignLocation/getPickList/groupPickList stay in repo.js unused (old data).

## Status
Retired (client changes 1).

## Files touched
src/db/repo.js (kept, unused), AppShell.jsx, App.jsx
