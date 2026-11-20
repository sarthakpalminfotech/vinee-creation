# Vinee Creation — textile trading ERP

React 19 + Vite + Tailwind. Data lives in the browser (SQLite via sql.js in IndexedDB) or in Turso when configured.

## Run
```bash
npm install
npm run dev          # http://localhost:5173  (empty local DB is filled with demo data on first open)
npm run build        # must pass
npm test             # end-to-end scenario + rule checks on a fresh in-memory DB (never touches real data)
npm run test:libsql  # the same scenario through the Turso code path, on a temporary local file: database
npm run lint
```
## Database / migrate / seed
- **Migrate:** automatic and additive on start (`src/db/schema.js`); see `docs/MIGRATIONS.md` for what exists and how to undo it.
- **Seed:** only into a completely empty *local* database. A remote database is never seeded unless `VITE_ALLOW_DEMO_SEED=true`. Settings → *Reset Demo Data* works in local mode only; Settings → *Download database backup* saves the local DB.
- **Remote (optional):** set `VITE_TURSO_DATABASE_URL`, `VITE_TURSO_AUTH_TOKEN` in `.env.local` (never commit them). `VITE_CLOUDINARY_*` are optional for photos.

## Modules added in client changes 2
Job Work (sidebar), Job workers master, Inventory → Withdraw (job work, Others, grey direct sell), Sell history and Withdrawals views. The app upgrades the database to schema_version 4 on first open (take a Turso snapshot first); deploy steps are unchanged.

## Client changes 3
Dyeing programs are issued against weaver challans (several qualities, takas and colours chosen by the user, "Add more takas"), the mill receipt works by weaver challan with a lot number per colour line, takas are shown meters-first everywhere (`src/components/TakaGrid.jsx`), and the layout is tablet-first. The app upgrades the database to schema_version 5 on first open (take a Turso snapshot first); deploy steps are unchanged. Viewport screenshots of the check are in `docs/screens/`.

## Docs (start here)
`docs/SPEC.md` (rules, decisions, open questions) · `docs/AUDIT.md` (traceability + issues) · `docs/tasks/` (per module) · `docs/PROGRESS.md` (what's next).

## Safety: never point a dev machine at the client's Turso database
`.env.local` holds the real Turso URL/token, so a plain `npm run dev` / `build` / `preview` would talk to it. For local work create **`.env.development.local`** with both values empty:
```
VITE_TURSO_DATABASE_URL=
VITE_TURSO_AUTH_TOKEN=
```
(`.env.[mode].local` wins over `.env.local`; Settings then shows **LOCAL**.) For a production-like local check use `.env.localtest.local` (same two empty lines), `npx vite build --mode localtest` and `npx vite preview --mode localtest`. Never run plain `npm run build` / `preview` on a machine that has `.env.local`. Both files are git-ignored (`*.local`). `tests/` refuses any remote database.

## Environment names
`VITE_TURSO_DATABASE_URL`, `VITE_TURSO_AUTH_TOKEN` (remote DB) · `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` (photos and voice notes; unsigned preset — **never** put a Cloudinary API key/secret in this app) · `VITE_ALLOW_DEMO_SEED` (almost never).

## Deploy steps (for the tech lead — not run by the developer)
1. **Cloudinary:** Settings → Upload → *Add upload preset* → Signing mode **Unsigned**, folder `vinee-creation`, allowed formats images + audio. Note the preset name and the **cloud name** (Dashboard). The API key/secret are not used by this app.
2. **Vercel:** Project → Settings → Environment Variables → add `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`. Check `VITE_TURSO_DATABASE_URL` / `VITE_TURSO_AUTH_TOKEN` are set for Production.
3. **Redeploy.** On first open the app upgrades the Turso database automatically (additive only, see `docs/MIGRATIONS.md`) and records `schema_version`. Take a Turso snapshot first.
4. **Smoke test on the live site:** create one test PO and grey challan; check they appear on a second device; delete nothing.
