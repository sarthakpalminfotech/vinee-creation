# D08 — Dyeing Program (create + PDF)
**Route:** `/programs/new`
## Build
Mill → quality (shows available grey takas at that mill) → shade chart → lines (shade + taka count). Validate Σ ≤ available. Auto-allocate takas FIFO to lines (status IN_DYEING, program_line_id). Print view: program no, mill, nick name, chart, each line with big **colour swatch**, shade no, taka count; total; signature area. Use browser print → "Save as PDF".
## Checks
48 available, lines 37×24 + 39×24 → saved; mill grey drops to 0.
## DoD
Print looks clean on A4 and colour swatches print (print-color-adjust: exact).
