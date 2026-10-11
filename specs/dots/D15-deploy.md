# D15 — Turso, Cloudinary, Deploy
## Steps
1. `curl -sSfL https://get.tur.so/install.sh | bash` → `turso auth login` → `turso db create vinee-creation` → `turso db show vinee-creation --url` → `turso db tokens create vinee-creation`.
2. Cloudinary: Settings → Upload → add **unsigned** preset `vinee`.
3. `.env.local` + `vercel env add` for the 4 vars in 02-architecture.md. Schema auto-creates on first load; seed runs only if empty.
4. `npx vercel --prod --yes`. Optionally disable Deployment Protection (Vercel → Settings → Deployment Protection) so client can open the link.
## DoD
Sidebar badge shows "Turso"; uploaded photo URL starts with res.cloudinary.com.
