# 02 — Architecture

## Stack
| Concern | Choice |
|---|---|
| UI | React 19 + Vite, React Router 7, Tailwind CSS 3, lucide-react icons (same as `evermend`/`safereport` refs) |
| DB | **Turso (libSQL)** via `@libsql/client/web` when `VITE_TURSO_DATABASE_URL` is set. Otherwise **local SQLite in browser** (`sql.js`, persisted to IndexedDB) with demo seed data. Same SQL for both. |
| Images | **Cloudinary** unsigned upload (`VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`). If not set, image is stored as data URL (prototype fallback). |
| PWA | `vite-plugin-pwa` (installable from Chrome). Icons in `public/pwa-*.png`. |
| Hosting | Vercel (`vercel --prod`). SPA rewrite in `vercel.json`. |

## Env vars (`.env.local`, and Vercel project env)
```
VITE_TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io
VITE_TURSO_AUTH_TOKEN=<token>
VITE_CLOUDINARY_CLOUD_NAME=<cloud>
VITE_CLOUDINARY_UPLOAD_PRESET=<unsigned preset>
```
> Prototype note: the Turso token is exposed to the browser. Before production move DB calls behind Vercel `/api` functions.

## Folder layout
```
src/
  db/
    client.js      # adapter: turso | local(sql.js). exports query(sql,args), exec, tx, mode
    schema.js      # CREATE TABLE statements (single source)
    seed.js        # demo data (only when DB empty)
    repo.js        # all domain queries/mutations (pages never write SQL)
  lib/
    format.js      # meters, money, dates, %
    cloudinary.js  # uploadImage(file) -> url
    takaParse.js   # parse pasted taka meter lists
  components/      # UI kit: Button, Card, Modal, Table, Field, Badge, Stat, Empty, PageHeader, PrintSheet…
  layout/          # AppShell (sidebar on ≥lg, bottom nav on mobile), nav config
  pages/           # one folder per module (masters, po, receipts, stock, dispatch, programs, finished, folding, orders, reports)
  App.jsx          # routes
```

## Rules for agents
1. Pages call `repo.*` only. New SQL goes in `repo.js`; new tables in `schema.js` (+ seed).
2. Every interactive element gets a stable `id` (for browser testing).
3. Mobile first: every list is a card list on `< md`, a table on `≥ md`.
4. Numbers: meters to 2 decimals, money ₹ with Indian grouping.
5. Documents for mill/customer print **nick name**; weaver-side screens show `original (nick)`.
6. After finishing a dot: `npm run build` must pass, update `specs/PROGRESS.md`, commit `feat(Dxx): …`, push.

## Design system
- Font: Inter. Palette "indigo-plum" with warm neutral background (`#f7f6f3`).
  - `brand` (indigo/violet 50–900), `accent` amber for warnings, emerald for success, rose for loss/wastage.
- Cards: white, `rounded-2xl`, soft shadow, 1px border `slate-200/70`.
- Status badges colour per taka status:
  GODOWN_GREY slate · MILL_GREY sky · IN_DYEING violet · FINISHED amber · FOLDED emerald · SOLD zinc.
- Micro-animations: fade/slide-in on page mount, hover lift on cards.
