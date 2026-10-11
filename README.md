# Vinee Creation — textile trading ERP

React 19 + Vite + Tailwind. Data lives in the browser (SQLite via sql.js in IndexedDB) or in Turso when configured.

## Run
```bash
npm install
npm run dev          # http://localhost:5173  (empty local DB is filled with demo data on first open)
npm run build        # must pass
npm test             # end-to-end scenario + rule checks on a fresh in-memory DB (never touches real data)
npm run lint
```
## Database / migrate / seed
- **Migrate:** automatic and additive on start (`src/db/schema.js`); see `docs/MIGRATIONS.md` for what exists and how to undo it.
- **Seed:** only into a completely empty *local* database. A remote database is never seeded unless `VITE_ALLOW_DEMO_SEED=true`. Settings → *Reset Demo Data* works in local mode only; Settings → *Download database backup* saves the local DB.
- **Remote (optional):** set `VITE_TURSO_DATABASE_URL`, `VITE_TURSO_AUTH_TOKEN` in `.env.local` (never commit them). `VITE_CLOUDINARY_*` are optional for photos.

## Docs (start here)
`docs/SPEC.md` (rules, decisions, open questions) · `docs/AUDIT.md` (traceability + issues) · `docs/tasks/` (per module) · `docs/PROGRESS.md` (what's next).
