# D01 — Masters
**Route:** `/masters/:tab` tabs: Weavers (groups + firms), Mills, Customers, Qualities, Locations, Shades.
## Build
- Weaver groups list; each group expands to firms; add/edit group & firm.
- Quality form: original name + nick name + default taka length. List shows `Nick` big, `original` small.
- Locations: Shop + Rack. Shades: chart selector, shade grid with colour swatch (colour picker).
- Search box on every tab. Modal forms. Delete only if unused (else show message).
## Checks
Add group "Ganesh Textile" with firms "Ganesh Fabrics", "Ganesh Fashion" → both visible. Add quality Nylon / Gold Lava → appears in PO quality picker as "Gold Lava (Nylon)".
## DoD
All 6 masters CRUD on mobile & desktop.
