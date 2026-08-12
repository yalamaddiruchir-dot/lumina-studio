# 🎬 Lumina Studios — Multimedia Company Management App

A full-stack studio management app for a media production company — covering everything from
staff to owner, with **role-based access levels** enforced on every request.

**Stack:** React 18 + Vite (frontend) · **Spring Boot 3 (Java 21)** API · **MySQL 8** database ·
JWT auth · bcrypt · Spring Security · hand-rolled SVG charts & icon system — zero external UI
dependencies.

> The repo also keeps the original **Node.js/Express + SQLite** backend in `server/` as a
> reference implementation. The active stack is Spring Boot + MySQL (in `api/`).

---

## ✨ Features

### Authentication & RBAC
- JWT login, protected routes, session persistence (localStorage)
- **6 access levels** — Owner (5) → Admin (4) → Manager / HR / Finance (3) → Staff (1)
- Every API endpoint is guarded by a permission capability; the UI hides what a role can't use
- Dedicated **Access Control** page showing the full role × capability matrix
- Staff data is **scoped**: staff only see projects/tasks/assets they're on, only their own
  timesheets, and salaries are stripped from API responses for non-privileged roles

### Modules
| Module | What you can do |
|---|---|
| **Dashboard** | Stat cards, budget-vs-spent chart, project pipeline donut, tasks-completed area chart, deadlines, activity feed, team workload |
| **Projects** | Full CRUD, status pipeline (planning → in_progress → review → on_hold → completed), budget tracking, detail page with tasks/team/assets |
| **Tasks** | Kanban board with 4 columns, **optimistic status moves**, filters, full CRUD |
| **Media Assets** | Grid media library (video/image/audio/document/design/3D), type filters, upload & delete |
| **Clients** | Full CRUD with project counts and total budgets |
| **Employees** | Full CRUD, role/department filters, access-level pills, salary visibility gated |
| **Timesheets** | Staff log hours → managers approve/reject (optimistic), filters by status/member |
| **Attendance** | Check in / check out, team presence summaries (HR/admin view all) |
| **Payroll** | Monthly records, finance/owner mark paid (admin view-only) |
| **Profile** | Edit own details, change password |

### UX polish
- Skeleton loading states, inline-SVG empty states, toast notifications
- Optimistic updates with rollback on error for status changes
- Global search palette (`⌘K`), notification bell with pending count
- Fully responsive — sidebar becomes a drawer with scrim on mobile

---

## 🚀 Run it (Spring Boot + MySQL)

**Prereqs:** JDK 21, Maven, and a MySQL/MariaDB server with a `lumina` database
(create: `CREATE DATABASE lumina CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`).

```bash
# 1. Build & run the API (port 3001) — auto-seeds demo data on first boot
cd api
mvn spring-boot:run        # or: mvn package -DskipTests && java -jar target/lumina-api.jar

# 2. In another terminal — frontend (port 5173, proxies /api → 3001)
cd ../client
npm install
npm run dev
```

Then open **http://localhost:5173**.

DB connection defaults (override with env vars, see `.env.example`):
`DB_URL=jdbc:mysql://127.0.0.1:3306/lumina`, `DB_USER=lumina`, `DB_PASSWORD=…`.

In development the API auto-seeds demo data on a fresh database (`SEED_DEMO=true`).
To reseed: drop the tables/DB and restart, or set `SEED_DEMO=true` with an empty DB.

### Ops commands (Spring API)

| Command | What it does |
|---|---|
| `cd api && mvn package -DskipTests` | Builds `target/lumina-api.jar` |
| `java -jar target/lumina-api.jar` | Runs the API (port 3001) |
| `SEED_DEMO=false ADMIN_EMAIL=x ADMIN_PASSWORD='…' java -jar …` | Production first boot — creates the initial Owner from env vars (no demo accounts) |

### The legacy Node backend

The original `server/` (Express + SQLite) is kept for reference. To run it instead:
`npm run install:all && npm run dev` — it listens on the same port 3001, so run only one backend at a time.The SQLite database lives at `data/lumina.db`. **In development** it auto-seeds with realistic
demo data on first boot; in production (`SEED_DEMO=false`) it starts empty and you create
real accounts with `npm run create:admin`. To reset dev data:

```bash
npm run reset:db      # removes the DB; re-seeds on next server start
```

### Ops scripts

| Command | What it does |
|---|---|
| `npm run build` | Builds the frontend into `client/dist` (required for production serving) |
| `npm run start` | Runs the API in production mode (`NODE_ENV=production`) |
| `npm run create:admin -- --name "X" --email x@co.com --password '…'` | Creates a real account from the CLI (used in production) |
| `npm run backup` | Consistent SQLite snapshot into `backups/` (keeps last 30) |

---


---

## 🌍 Deploy to production (Spring Boot + MySQL)

Production-hardened: Docker + Caddy (auto-HTTPS), MySQL with persistent volume, admin
bootstrapping, rate-limited login, and nightly dumps. **Sizing: a single instance comfortably
serves ~30 concurrent users** — no cluster needed.

### 1. Prepare the server (Ubuntu 24.04 example)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
# point your domain's DNS A record at this server's IP
```

### 2. Configure

```bash
git clone <your-repo> lumina-studio && cd lumina-studio
cp .env.example .env
nano .env
```

| Variable | Value |
|---|---|
| `JWT_SECRET` | `openssl rand -hex 32` — **required** (app refuses to boot without it in prod) |
| `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD` | Strong DB passwords |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First account (Owner) — created automatically on first boot with an empty DB |
| `DOMAIN` | `app.company.com` (enables HTTPS via Caddy) |
| `SEED_DEMO` | `false` — **never** true in production |

### 3. Launch

```bash
docker compose --profile proxy up -d --build
```

Starts: **mysql** (persistent volume) → **api** (Spring Boot, waits for MySQL health) →
**caddy** (80/443, automatic Let's Encrypt). Visit **https://app.company.com**.

### 4. First account

With `ADMIN_EMAIL` + `ADMIN_PASSWORD` in `.env`, the first boot creates the Owner account
automatically — no demo accounts, no separate CLI step. Remove those vars from `.env` afterwards.

### 5. Backups (MySQL)

```bash
docker compose exec mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" lumina' \
  > backups/lumina-$(date +%F).sql
```

Put that in a nightly cron and **copy snapshots offsite** (S3/Drive/another server) —
payroll data lives here. See `deploy/backup-cron.example` for the non-Docker variant.

### 6. Updates

```bash
git pull && docker compose --profile proxy up -d --build
```

### Without Docker (bare metal)

JDK 21 + MySQL, then follow `deploy/lumina.service` (systemd). Or:
`cd api && mvn package -DskipTests && java -jar target/lumina-api.jar` behind Caddy/Nginx.

### Production checklist

- [ ] `JWT_SECRET` set, `SEED_DEMO=false`, strong MySQL passwords
- [ ] HTTPS enforced (Caddy), login rate-limited (20/15 min — built-in), CORS same-origin
- [ ] Nightly offsite MySQL dumps, restore tested once
- [ ] `ufw allow 22,80,443`; SSH keys only, root login disabled
- [ ] Offboarding: set departing employees to "inactive" immediately
- [ ] Media files go on object storage (S3/R2) with signed URLs — the app tracks metadata

---

## 🧱 Project structure

```
lumina-studio/
├── api/                      # ★ Spring Boot 3 API (Java 21) — the active backend
│   ├── pom.xml               # Spring Web, Security, JDBC, MySQL driver, JWT, validation
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/luminastudio/
│       │   ├── config/       # AppProperties, SecurityConfig, DataInitializer (seed + admin bootstrap)
│       │   ├── security/     # JwtService, JwtAuthFilter, Permissions matrix, Auth helpers
│       │   ├── service/      # ActivityLogService
│       │   ├── util/         # JDBC helpers
│       │   └── web/          # 11 REST controllers (auth, employees, clients, projects, tasks,
│       │                     #   assets, timesheets, attendance, payroll, dashboard, activity)
│       └── resources/        # application.yml, schema.sql (MySQL DDL)
├── client/                   # React 18 + Vite frontend (unchanged — consumes the same REST API)
├── server/                   # ⏳ legacy Node/Express + SQLite backend (reference only)
├── deploy/                   # systemd unit, backup cron template
├── docker-compose.yml        # mysql + api + caddy (auto-HTTPS)
├── Caddyfile
└── .env.example
```
