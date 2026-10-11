# D00 — Foundation (shell, design system, data layer, PWA)
**Goal:** App skeleton every other dot plugs into.
## Build
- Tailwind 3 + Inter + design tokens (`tailwind.config.js`, `src/index.css`).
- `AppShell`: sidebar (≥lg), top bar + bottom nav + "More" sheet (mobile/tablet).
- UI kit in `src/components/ui.jsx` (Button, Card, Field/Input/Select, Modal, Badge, Stat, PageHeader, Empty, Table helpers).
- `src/db/client.js` adapter (Turso if env, else sql.js+IndexedDB), `schema.js`, `seed.js` (realistic demo data), `repo.js`.
- PWA manifest + icons (`public/pwa-192x192.png`, `pwa-512x512.png`), `vercel.json` SPA rewrite.
## Checks
1. `npm run build` passes. 2. Resize 375 / 768 / 1280 px → nav adapts. 3. Reload keeps data (IndexedDB). 4. Chrome shows "Install app".
## DoD
Shell renders all nav entries; DB mode badge (Local / Turso) visible in sidebar footer; "Reset demo data" in Settings works.
