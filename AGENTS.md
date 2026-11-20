# AGENTS.md — Start here (any AI / developer)

Project: **Vinee Creation** — textile trading ERP prototype (grey PO → weaver challan → godown racks → mill → dyeing program → finished → folding → customer orders, with per-taka wastage).

> **Current authority: `docs/` (SPEC, AUDIT, tasks/, PROGRESS).** The `specs/` dots below are the original generated plan; where they disagree, `docs/SPEC.md` wins. Run `npm test` before committing.

## Resume protocol ("dots")
The work is split into small, independent **dots** (`specs/dots/Dxx-*.md`). Each dot has: Goal → Build → Checks → DoD.
1. Read `specs/01-business.md` (domain), `specs/02-architecture.md` (stack/rules), `specs/03-data-model.md`.
2. Open `docs/PROGRESS.md` → pick the first dot not `✅ Done`.
3. Build only that dot. Run its Checks. `npm run build` must pass.
4. Update `docs/PROGRESS.md` (status + notes/decisions), commit `feat(Dxx): …`, push.
5. Never change business rules silently — record decisions in PROGRESS.md "Decisions log".

## Commands
```bash
npm run dev          # local dev (http://localhost:5173)
npm run build        # must pass before commit
npx vercel --prod --yes   # deploy
```

## Key files
- `src/db/schema.js` · `src/db/seed.js` · `src/db/repo.js` (all data access)
- `src/components/ui.jsx` (UI kit) · `src/components/AppShell.jsx` (navigation)
- `src/pages/**` (one folder per module)
