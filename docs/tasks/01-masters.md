# Masters

**Rules:** R-M-1..6

## What to do
Parties, mills and customers (optional GSTIN), qualities, branches, and the common colour library (shade name, description, colour picker and/or photo). Each quality has a Colours panel: add from library, add own colour, active toggle, last used, remove only when never used. No Items tab, no Racks tab, no shade charts.

## What to check
GSTIN saves in capitals and warns (amber) when invalid; a private colour is not in the library; a used colour cannot be removed; /masters/items redirects to /masters/qualities.

## Done when
Colours belong to qualities; programs and orders accept only linked + active colours (repo.js).

## Status
Done (client changes 1). Automated: npm test.

## Files touched
src/pages/masters/MastersPage.jsx, Colours.jsx, src/components/ImagePicker.jsx, src/db/repo.js
