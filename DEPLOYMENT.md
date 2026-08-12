# 🌍 Deploying Lumina Studios — GitHub + Cloud

This app is a **single container** (Spring Boot API **+** built React frontend) backed by
**MySQL**. That makes cloud deployment simple: 1 web service + 1 database.

---

## Part 1 — Push to GitHub

Run these on your Mac **inside the project folder**:

```bash
cd <your-project-folder>        # the folder containing api/, client/, docker-compose.yml

git init
git add -A
git commit -m "Lumina Studios — initial commit"
```

Then create an **empty** repo at https://github.com/new (name it e.g. `lumina-studio`,
don't tick "Add a README" — you already have one) and connect it:

```bash
git remote add origin https://github.com/YOUR_USERNAME/lumina-studio.git
git branch -M main
git push -u origin main
```

> **Check before pushing** — the `.gitignore` already excludes `node_modules/`, `api/target/`,
> `client/dist/`, `data/`, `backups/`, `.env`. The push should contain ~95 source files only.
> **Never** commit a real `.env` file.

After pushing, GitHub Actions (`.github/workflows/ci.yml`) builds the API + frontend and
shows a green ✅ on your repo.

---

## Part 2 — Pick a platform

| Platform | Cost to start | MySQL | Ease | Notes |
|---|---|---|---|---|
| **Railway** ⭐ recommended | ~$5 trial credit | ✅ built-in plugin | Easiest | One click MySQL + Dockerfile deploy |
| **Render** | Free web tier | ❌ none → use Aiven free MySQL | Easy | Blueprint included (`render.yaml`) |
| **Fly.io** | Free VM allowance | ✅ managed MySQL | Moderate | Great if you already use Fly |
| **VPS + Docker** | ~₹500/mo | ✅ bundled | Moderate | Full control; use `docker-compose.yml` |

---

## Option A — Railway (recommended)

1. Sign up at https://railway.app (GitHub login).
2. **New Project → Deploy from GitHub repo** → pick `lumina-studio`.
3. Railway reads `railway.toml` → builds `api/Dockerfile` automatically.
4. **Add MySQL:** in the project, **New → Database → MySQL**. Copy the connection details.
5. Add these **Variables** to the web service (Variables tab):

   | Variable | Value |
   |---|---|
   | `JWT_SECRET` | `openssl rand -hex 32` output |
   | `SEED_DEMO` | `false` |
   | `PROD` | `true` |
   | `DB_URL` | `jdbc:mysql://<mysql-host>:3306/lumina?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC` |
   | `DB_USER` | Railway MySQL user |
   | `DB_PASSWORD` | Railway MySQL password |
   | `ADMIN_NAME` | e.g. `Studio Owner` |
   | `ADMIN_EMAIL` | your email |
   | `ADMIN_PASSWORD` | a strong password (min 8 chars) |

6. Deploy. When it's up, click **Generate Domain** → open it → sign in with
   `ADMIN_EMAIL` / `ADMIN_PASSWORD` (created automatically on first boot).
7. **Note:** the DB name must exist — Railway's MySQL plugin creates the `lumina` database
   if you set it in the URL path, or create it via their SQL tab: `CREATE DATABASE IF NOT EXISTS lumina;`
8. Optional: Settings → Networking → Custom Domain → `app.yourdomain.com`.

---

## Option B — Render

Render has no managed MySQL, so pair it with a **free Aiven MySQL**:

1. https://aiven.io → sign up → **Create service → MySQL** (free plan, ~1 GB). Get the
   host/port/user/password + `CA cert` (enable **SSL**).
2. Create the DB: use Aiven's console SQL tab → `CREATE DATABASE lumina;`
3. Render → **New → Blueprint** → pick your repo (uses `render.yaml`).
4. Fill in the env vars (including `DB_URL` with `useSSL=true&requireSSL=true&serverTimezone=UTC`).
5. Deploy; the service listens on the injected `PORT`, health check `/api/health`.

---

## Option C — Fly.io

```bash
flyctl auth login
flyctl launch --no-deploy      # answer prompts, choose repo root
flyctl mysql create            # creates a managed MySQL cluster (name: lumina-db)
flyctl mysql connect lumina-db -c "CREATE DATABASE lumina;"
flyctl secrets set JWT_SECRET="$(openssl rand -hex 32)" SEED_DEMO=false PROD=true \
  DB_USER=... DB_PASSWORD=... "DB_URL=jdbc:mysql://<fly-mysql-host>:3306/lumina?useSSL=false&serverTimezone=UTC" \
  ADMIN_EMAIL=... ADMIN_PASSWORD=...
flyctl deploy
flyctl open
```

---

## Part 3 — After it's live

- **First account** — created automatically from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on an empty
  DB. Remove those vars afterwards.
- **Demo data** — `SEED_DEMO=false` means **no** demo accounts in production (that's what
  you want for a real company). To preview with sample data, set `SEED_DEMO=true` once.
- **Domain + HTTPS** — Railway/Render/Fly give you `https://` automatically; custom domain
  in their settings (or add the Caddy profile in `docker-compose.yml` on a VPS).
- **Backups** — schedule a nightly `mysqldump` (see `deploy/backup-cron.example`) and copy
  snapshots offsite.
- **Media files** — the app stores metadata; put actual photo/video files on S3/R2 with
  signed URLs for production scale.

---

## Env vars — full reference

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | ✅ | Token signing key (`openssl rand -hex 32`) |
| `DB_URL` | ✅ | JDBC URL to MySQL |
| `DB_USER` / `DB_PASSWORD` | ✅ | MySQL credentials |
| `SEED_DEMO` | ✅ | `false` in production (no demo accounts) |
| `PROD` | ✅ | `true` — enables rate limiting, helmet, strict JWT check |
| `ADMIN_NAME/EMAIL/PASSWORD` | first boot | Creates the initial Owner account |
| `CORS_ORIGINS` | optional | Comma-separated allowed origins (same-origin default) |
| `PORT` | auto | Platform injects it; default 3001 |
