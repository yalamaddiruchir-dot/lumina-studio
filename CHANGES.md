# 📦 Lumina Studios — Changes in this update

**Date:** 11 Aug 2026
**Why:** `npm install` failed on macOS with Node v26 with `better-sqlite3` native-build
errors (`no member named 'GetPrototype'`, `gyp ERR! build error`).

---

## What was fixed

Your machine runs **Node v26.4.0**. The previous version of this app depended on
`better-sqlite3@^11`, a native addon that cannot compile against Node 26's V8 API — so
`npm install` aborted and the app couldn't start.

This update makes SQLite work on **any modern Node version with zero compilation**:

1. **`server/db.js`** — new universal database adapter:
   - **Node ≥ 22.5** → uses the **built-in `node:sqlite`** module (no native build,
     no node-gyp, no Xcode Command Line Tools required)
   - **Older Node** (18–22) → automatically falls back to `better-sqlite3`
   - The server log tells you which driver is in use:
     `[db] using built-in node:sqlite` or `[db] … using better-sqlite3`

2. **`package.json`** — moved `better-sqlite3` from `dependencies` to
   `optionalDependencies`, so even if its native build fails it can **never abort
   `npm install`** again (it just prints a warning and continues). Also added
   `"engines": { "node": ">=18" }`.

3. **`server/seed.js`** — fixed a seed-data bug that the stricter built-in driver
   caught (`Unknown named parameter 'hue'`). The demo `hue` value is now correctly
   mapped to the `avatar_hue` column.

4. **`package-lock.json`** — regenerated for the new dependency layout.

5. **`README.md`** — added a "Troubleshooting" section for Node 26 / macOS.

## Changed files (these 5 only)

| File | Change |
|---|---|
| `server/db.js` | Rewritten with the node:sqlite ↔ better-sqlite3 adapter |
| `server/seed.js` | One-line fix (hue → avatar_hue mapping) |
| `package.json` | better-sqlite3 → optionalDependencies; engines field |
| `package-lock.json` | Regenerated lockfile |
| `README.md` | Troubleshooting section added |

Everything else is unchanged — same app, same features, same demo data.

---

## How to apply on your Mac

### Option A — replace the whole project (recommended)

1. Unzip this archive — you'll get a `lumina-studio/` folder.
2. Replace your existing `lumina-studio` folder with this one
   (or unzip to a fresh location).
3. Delete any old install leftovers, then install fresh:

```bash
cd lumina-studio
rm -rf node_modules client/node_modules client/dist
npm run install:all
npm run dev
```

4. Open **http://localhost:5173** → sign in with `owner@lumina.studio` / `demo123`
   (or click a demo account chip).

### Option B — patch in place

Copy just the 5 changed files over your existing copy, then run `npm install` again
(the new `package.json` will move `better-sqlite3` to optional automatically).

---

## What you should see

- During install: possibly a `prebuild-install` / `better-sqlite3` **warning** —
  **expected and harmless** now. The install will complete.
- On server start: `[db] using built-in node:sqlite` (Node 26) and the app works.
- First boot seeds the database automatically (16 employees, 7 clients, 12 projects,
  30 tasks, 20 assets, timesheets, attendance, payroll).

---

# 📦 v1.1 — Production hardening & deployment tooling

**Date:** 11 Aug 2026
**Goal:** make the app safe to run publicly for a real company (~30 users).

## Changes

| File | Change |
|---|---|
| `server/config.js` | Env-driven config (`dotenv`); `JWT_SECRET` **required** in production (fail-fast); `CORS_ORIGINS`, `SEED_DEMO`, `BACKUP_DIR` |
| `server/index.js` | Helmet security headers (prod), `express-rate-limit` (login 20/15min + API 600/15min, prod only), CORS allowlist (same-origin default in prod), `trust proxy`, serves built frontend + SPA fallback (prod), demo seed gated behind `SEED_DEMO` |
| `scripts/create-admin.js` | **New** — CLI to create the first real account in production (validates email/password/role, rejects duplicates) |
| `scripts/backup.js` | **New** — consistent `VACUUM INTO` snapshot, keeps last 30, collision-proof filenames |
| `Dockerfile` | **New** — multi-stage (node:22, builds client, slim runtime, non-root user, healthcheck) |
| `docker-compose.yml` | **New** — app service + optional Caddy proxy (`--profile proxy`) with auto-HTTPS, persistent volume, mem limits |
| `Caddyfile` | **New** — auto Let's Encrypt HTTPS + security headers |
| `deploy/lumina.service` | **New** — systemd unit for bare-metal installs |
| `deploy/backup-cron.example` | **New** — nightly backup cron |
| `.env.example` / `.gitignore` | **New** — config template; ignores secrets, DB, builds |
| `package.json` | Added `dotenv`, `helmet`, `express-rate-limit`; scripts `start`, `build`, `create:admin`, `backup` |

## Verified (both SQLite drivers)

- Fresh production boot with `SEED_DEMO=false` → **no demo accounts**, warns to run `create:admin`
- `create-admin` → login → dashboard, weak/duplicate accounts rejected
- Helmet headers present (CSP, HSTS, frame-ancestors, nosniff)
- Login rate limit returns 429 after 20 rapid attempts
- SPA fallback serves the app on `/dashboard` (deep links work)
- Backup snapshot opens read-only and restores (10 tables, all rows)

---

# 📦 v2.0 — Spring Boot + MySQL backend (replaces Express/SQLite)

**Date:** 11 Aug 2026
**Requested:** "we can use MySQL right, and I also want Spring Boot in my API"

## What changed

| Area | Before | After |
|---|---|---|
| Backend | Node.js + Express (`server/`) | **Spring Boot 3 (Java 21)** (`api/`) |
| Database | SQLite (embedded file) | **MySQL 8 / MariaDB** (real server) |
| Auth | jsonwebtoken + bcryptjs | **Spring Security + jjwt + BCryptPasswordEncoder** |
| Stack | JavaScript everywhere | **Java backend, React frontend unchanged** |

The **React frontend is untouched** — it consumes the exact same REST API shapes
(`/api/auth`, `/api/employees`, … `/api/dashboard`), so the UI works identically.

## New files

- `api/pom.xml` — Spring Boot 3.3.5, Web, Security, JDBC, mysql-connector-j, jjwt 0.12, validation, spring-dotenv
- `api/src/main/resources/{application.yml,schema.sql}` — env-driven config; idempotent MySQL DDL (10 tables + indexes + FKs)
- `api/src/main/java/com/luminastudio/…`
  - `config/` — `AppProperties`, `SecurityConfig` (stateless JWT, CORS allowlist, BCrypt), `DataInitializer` (demo seed **and** production `ADMIN_*` bootstrap)
  - `security/` — `JwtService`, `JwtAuthFilter` (401 JSON parity), `Permissions` (role matrix ported from config.js), `Auth` helpers, `LoginRateLimiter`
  - `web/` — 11 controllers mirroring every route 1:1, incl. salary stripping & staff scoping
  - `util/Db.java`, `service/ActivityLogService.java`
- `api/Dockerfile`, `api/.dockerignore`
- `docker-compose.yml` — **mysql:8** (healthcheck, volume) + **api** (Spring) + optional **caddy** (auto-HTTPS)
- `.env.example` — DB credentials, `ADMIN_*`, `JWT_SECRET`, `DOMAIN`, `SEED_DEMO`
- `deploy/lumina.service` — systemd unit for the jar
- `deploy/backup-cron.example` — nightly `mysqldump` (transaction-consistent)

## Behavior parity (verified end-to-end against real MariaDB)

- ✅ All 11 endpoints, all CRUD + status flows, 201 on creates
- ✅ JWT login/me/change-password, 401/403 JSON identical to before
- ✅ Role matrix (owner…staff), salary stripped for non-privileged, staff project/task scoping
- ✅ Production first boot: `SEED_DEMO=false` + `ADMIN_EMAIL/ADMIN_PASSWORD` → Owner auto-created, demo accounts dead
- ✅ Rate limiting: 429 after 20 login attempts/15 min (prod)
- ✅ Fail-fast: refuses to boot in prod without `JWT_SECRET`
- ✅ Frontend browser-tested against the Spring backend — all pages, zero console errors

## Running it

See README. Quick: `cd api && mvn spring-boot:run` (needs MySQL on 3306) + `cd client && npm run dev`.

The old `server/` (Express/SQLite) is kept as a reference implementation and is no longer the active backend.

---

# 📦 v2.1 — Wedding/album studio org chart + production pipeline workflow

**Date:** 11 Aug 2026
**Requested:** new roles/departments (OWNER → Management / Production Team / Sales & Client
Management / Finance / Administration) and a sequential production workflow
(Data Copy → Lightroom → Video → Album → Final Review → Delivered).

## What changed

### Roles (8 access levels)
`owner (5)` · `admin` System Admin (4) · `manager` (3) · `hr` HR/Admin (3) · `finance` (3) ·
`sales` (2) · `quality` Quality Control (2) · `production` (1)

### Departments & positions (org chart)
- **Management** — Manager, Project Manager
- **Production Team** — Data Copy Operator (×2), Lightroom Editor (×2), Senior Lightroom Editor,
  Video Editor (×2), Senior Video Editor, Album Designer, Senior Album Designer, Quality Controller
- **Sales & Client Management** — Sales Executive, Client Coordinator
- **Finance** — Accountant, Billing Executive
- **Administration** — HR / Admin, System Administrator

### Project pipeline (the workflow)
Project status is now a sequential stage: **Booked → Data Copy → Lightroom → Video → Album →
Final Review → Delivered** (plus Cancelled).

- New `PATCH /api/projects/{id}/stage` endpoint — **server-enforced**:
  - Only the *next* stage is allowed (skipping → 400 with a clear message)
  - Only roles with `pipeline.advance` may move it (Owner, System Admin, Manager, Quality Controller)
  - Delivered is terminal; Cancelled only by Owner/Admin/Manager
  - Progress% is derived automatically from the stage position
- Frontend: **pipeline stepper** on every project detail page with an "Advance to next stage"
  button, stage badges on project cards, and each task card shows its project's current stage
- Dashboard donut + project filters now use the pipeline stages

### Data
Demo seed rewritten for a wedding/album studio: 20 employees across the org chart, wedding/event
clients, 13 projects spread across pipeline stages, stage-specific tasks (RAW ingest, Lightroom
grading, album layout, QC), and matching assets/timesheets/attendance/payroll.

## Files touched
- `api/.../security/Permissions.java` — new roles/labels/matrix + `PIPELINE` + `nextStage()`
- `api/.../web/ProjectController.java` — `PATCH /{id}/stage`, scoped roles (production/quality/sales)
- `api/.../web/{Task,Asset,Timesheet,Dashboard}Controller.java` — scoped-role helpers, `project_status` in task selects, pipeline status filters
- `api/.../config/DataInitializer.java` — new org seed data
- `api/src/main/resources/schema.sql` — defaults: role `production`, project status `booked`
- `client/...` — `AuthContext` (new matrix), `ui.jsx` (ROLE_META/STATUS_META/PIPELINE),
  `Projects`, `ProjectDetail` (stepper + advance), `Tasks` (stage badges), `Employees`,
  `Login` (8 demo accounts), `Dashboard`, `AccessControl`, `icons` (heart/ring), `styles` (teal badge)
- `server/config.js` — legacy Node backend parity (roles + pipeline)

---

# 📦 v2.2 — Signup (real accounts, isolated workspace) + Sign out

**Date:** 11 Aug 2026
**Requested:** signup button; signed-up accounts must NOT see the mock/demo data (that is only
for the pre-seeded demo accounts); a sign-out button at the bottom-left of the sidebar that
returns to the login page.

## What changed

### 1. Signup (`POST /api/auth/signup`) + UI
- New public endpoint: name + email + password (≥6 chars), validates email format and
  uniqueness, auto-logs-in (returns token + user), role defaults to **manager** so a new
  account can actually run their workspace (create clients/projects/tasks, advance their
  own pipeline). No demo accounts are created.
- Login page now has **Sign in / Create account** tabs; the demo-account chips show only in
  Sign-in mode, labelled "Demo accounts — pre-loaded with sample data".

### 2. Demo vs Real workspace isolation
- `users.is_demo` flag: the 20 seeded accounts are `is_demo=1`; signed-up accounts are `0`.
- `created_by` added to clients/projects/tasks/assets/timesheets/attendance/payroll.
- **Real accounts see only their own records** (created_by = me) — never the mock data —
  on every endpoint + dashboard aggregates. Employees list shows only their own profile.
- **Demo accounts see the full sample workspace** (and can manage real accounts/roles).
- Ownership enforced: real accounts get 403 trying to edit/delete/advance records they
  didn't create.

### 3. Sign out button
- Added to the sidebar footer (bottom-left, beside the profile name): clears the session and
  navigates to `/login`.

## Files touched
- `api/.../web/AuthController.java` — signup endpoint
- `api/.../config/SecurityConfig.java` — permit `/api/auth/signup`
- `api/.../security/{Auth,JwtAuthFilter}.java` — `is_demo` loading + `isDemo()`, `requireOwnership()`
- `api/.../web/{Employee,Client,Project,Task,Asset,Timesheet,Attendance,Payroll,Dashboard}Controller.java` — scoping + ownership
- `api/src/main/resources/schema.sql` — `users.is_demo`, `created_by` columns
- `client/.../AuthContext.jsx` — `signup()`
- `client/.../pages/Login.jsx` — Sign in / Create account tabs
- `client/.../components/Layout.jsx` — sign-out button
- `client/.../styles.css` — `.sidebar__logout`

> **Note for existing DBs:** run `DROP DATABASE lumina; CREATE DATABASE lumina …` once
> (or delete the tables) so the new columns are created, then restart — it re-seeds.

---

# 📦 v2.3 — Client Photo Gallery & Album Approval

**Date:** 12 Aug 2026
**Requested:** new business feature — "Client photo gallery + album approval: upload photos per order, client picks favorites, album gets approved inside the app."

## What was built

### 📸 Photo gallery per order
- New `photos` table: project, name, url, **category/segment** (Ceremony, Pre-Wedding, Portraits, Reception, Family, Couple, Engagement, Corporate, Destination, Celebration), size, captured date, status, uploader.
- New endpoints:
  - `GET /api/projects/{id}/photos?status=` — gallery for an order (isolation-aware)
  - `POST /api/projects/{id}/photos` — upload a photo (requires `assets.upload`: production/QC/manager/admin/owner)
  - `PATCH /api/photos/{id}` — status moves with **server-enforced workflow**
  - `DELETE /api/photos/{id}` — uploader or `assets.delete` roles

### ✅ Album approval workflow (uploaded → selected → approved)
- **Uploaded** — studio adds culled photos.
- **Client selected** — client-facing roles (Sales/Client Coordinator via `clients.manage`, plus Manager/Admin/Owner) mark favourite frames.
- **Approved** — only `pipeline.advance` roles (Owner/Admin/Manager/Quality Controller) sign off; photos must be *selected* first (skipping → 400).
- Production staff cannot approve or delete others' photos (403).

### 🖥 UI
- **Gallery card on every order page**: photo grid, live count filters (All / Uploaded / Selected / Approved), status badges, per-photo **Select / Revert / Approve / Delete** actions with optimistic updates, empty state, and an **Add photo** modal.
- Project cards now show the photo count (📷 12) with a tooltip for selected count.
- Seeded 38 realistic wedding/event photos across 6 demo orders in various workflow states.

### Isolation
- Real (signed-up) accounts: only photos on orders they created (403 otherwise). Demo accounts: full sample galleries.

## Files touched
- `api/.../web/PhotoController.java` (new)
- `api/.../web/ProjectController.java` — photo_count / selected_photos in queries
- `api/.../config/DataInitializer.java` — 38 seeded photos
- `api/src/main/resources/schema.sql` — photos table
- `client/.../pages/ProjectDetail.jsx` — gallery card, filters, actions, PhotoModal
- `client/.../pages/Projects.jsx` — photo count on cards
- `client/.../components/ui.jsx` — uploaded/selected/approved badges

## Verified
- API: upload → sales select → QC approve; skip-approval rejected; production/sales blocked from approving; delete rules; real-account 403 on demo galleries.
- Browser: all 12 gallery checks pass — grid renders, filters with counts, upload modal, select→approve flow, optimistic updates, delete; zero console errors.

---

# 📦 v2.4 — GST invoicing & payments, shoot calendar, demo accounts for every position

**Date:** 12 Aug 2026
**Requested:** GST invoicing & payment tracking + shoot calendar + demo accounts for all roles/positions (video editor, lightroom editor, etc.).

## 1. GST invoicing & payment tracking
- New `invoices` + `payments` tables; endpoints:
  - `GET /api/invoices` (+filters), `GET /api/invoices/{id}` (detail + payments)
  - `POST /api/invoices` — create from an order; auto `INV-YYYY-####` number; base + GST (0/5/12/18/28%) + total + advance
  - `POST /api/invoices/{id}/payments` — record cash/UPI/bank/card/cheque payment; recomputes advance/balance/status; overpayment rejected
  - `PATCH /api/invoices/{id}` (draft/sent/paid/cancelled), `DELETE` (draft only)
- Status: draft → sent → partial → paid, with **overdue** auto-derived past the due date
- New capabilities `invoices.view` (Owner/Admin/Finance/Manager/Sales) + `invoices.manage` (Owner/Admin/Finance); enforced server-side
- UI: **Invoices** page — GST summary cards (invoiced/GST/collected/outstanding), status filters, search, create-invoice modal with live GST preview, detail drawer with payment history + record-payment modal
- Isolation: real accounts only see invoices on their own orders

## 2. Shoot calendar
- `projects.shoot_date` (create/edit + seed values)
- `GET /api/calendar?month=YYYY-MM` → shoots, deliveries (deadlines), task due dates, invoice dues (isolation-aware)
- UI: **Calendar** page — Monday-first month grid, colour-coded events (Shoot/Delivery/Task/Invoice due), month navigation + Today, event counts legend, click-through to project/task/invoice

## 3. Demo accounts for every position
- Login page now lists **20 demo accounts — one per position** (Owner, Manager, Project Manager, System Administrator, HR/Admin, Accountant, Billing Executive, Sales Executive, Client Coordinator, Data Copy Operators, Lightroom Editors + Senior, Video Editors + Senior, Album Designers + Senior, Quality Controller). All share password `demo123` and the sample workspace.
- Fixed nested-modal bug found while testing payments (payment modal now renders at page level).

## Files touched
- `api/.../web/InvoiceController.java` (new), `CalendarController.java` (new)
- `api/.../web/ProjectController.java` — shoot_date
- `api/.../security/Permissions.java` — invoices caps; `AuthContext.jsx` mirror
- `api/.../config/DataInitializer.java` — shoot dates, 6 seeded invoices + payments
- `api/src/main/resources/schema.sql` — invoices, payments, projects.shoot_date
- `client/.../pages/Invoices.jsx` (new), `Calendar.jsx` (new), `Login.jsx` (20 demo accounts), `Projects.jsx` (shoot date), `ProjectDetail.jsx` (shoot date in meta), `App.jsx`/`Layout.jsx` (routes + nav), `ui.jsx` (invoice badges, Modal `top`), `Invoices` payment flow refactor

---

# 📦 v2.5 — GitHub & cloud-deploy ready (single-container)

**Date:** 12 Aug 2026
**Requested:** push the project to GitHub and deploy it on a cloud platform.

## What changed
- **API now serves the React frontend itself** (`SpaFilter` + `StaticConfig`): one container
  serves the SPA (with deep-link support) and `/api` — no separate static host needed.
- `api/Dockerfile` is now a 3-stage build: client (`npm run build`) → jar (`mvn package`) →
  slim runtime with both bundled. Build context = repo root.
- `docker-compose.yml` simplified: MySQL + one API container (Caddy optional for HTTPS).
- `Caddyfile` simplified to pure reverse proxy.
- **New deploy configs:** `railway.toml`, `render.yaml`, `.github/workflows/ci.yml`
  (GitHub Actions builds both halves), `DEPLOYMENT.md` (step-by-step GitHub + Railway/
  Render/Fly guide).
- `.gitignore` hardened (`api/target/`, `.idea`, `.DS_Store`, etc.).
- Security: static assets + SPA shell are public; `/api/**` remains fully JWT-protected
  (verified: deep links 200, API 401 without token).

## Verified (single-container topology, no Vite/proxy)
- `/`, `/dashboard`, `/projects/2` serve the SPA; JS/CSS assets 200
- Full app works through the container: login, dashboard, gallery, invoices, calendar —
  zero console errors, all checks pass.

---

# 📦 v2.6 — Restricted employee creation, no signup, estimations + PDF, inventory

**Date:** 13 Aug 2026
**Requested:** (1) only Owner/Manager/HR can create employee logins; (2) remove signup from the
login page; (3) Owner/Manager can estimate event cost (cameras, employees, equipment) with
employee availability + a printable PDF quotation; (4) Owner can manage equipment inventory
(cameras, hard disks, stands) with rent per event; (5) push to GitHub.

## 1. Employee creation — Owner / Manager / HR only
- **Admin (System Administrator) no longer has `employees.manage` / `employees.delete`** —
  the Add/Edit/Remove controls disappear for admin; only Owner, Manager and HR create logins.
- **Manager gained `employees.manage` / `employees.delete`** (previously view-only).
- Employee creation now sets `is_demo=0` (a real, isolated workspace — no mock data) and
  accepts an optional **login password** field in the modal (default `demo123`).

## 2. Signup removed
- Login page has **no "Create account" tab** — single sign-in form + demo chips.
- `POST /api/auth/signup` disabled server-side (removed from permit-all, returns 401/403).
  All accounts are created by the studio.

## 3. Event cost estimation (Owner + Manager) with PDF
- New `estimates` + `estimate_employees` + `estimate_equipment` tables; endpoints:
  - `GET/POST /api/estimates`, `GET /api/estimates/{id}`, `PATCH /{id}` (status), `DELETE`
  - `GET /api/estimates/{id}/pdf` — **OpenPDF-generated quotation**: company name,
    studio license, estimate no, client, event, itemised breakdown (cameras × rate × days,
    team × rate × days, equipment, extras), GST 18%, total, team list, notes/terms.
  - `GET /api/employees/available?date=` — who's free on the event date (excludes members
    already booked on an order shooting that day or on leave); the form also lists the busy ones.
- Cost model: cameras × camera_rate × days + team × employee_rate × days + equipment
  (inventory rent × qty × days) + extras, then GST.
- UI: **Estimations** page — list, create modal with live availability chips, equipment
  picker from inventory, live cost summary, status flow, PDF download, detail view.

## 4. Equipment inventory (Owner)
- New `inventory` table + CRUD: cameras, hard disks, stands, equipment with quantity and
  **rent per event**.
- Owner manages (`inventory.manage`); Manager views (`inventory.view`) so they can add
  equipment into estimations.
- UI: **Equipment** page (list, filters by category, add/edit/delete, rent shown ₹/event).
- Seeded 12 realistic items (Sony/Canon cameras, SSDs/HDDs, tripods, gimbals, LED kits, drone).

## Verified
- API: admin→403 create employee, manager/hr→201; signup blocked; inventory owner-only writes;
  availability correctly shows booked members; estimate costing (14800 + 18% = 17464) correct;
  PDF contains company/license/breakdown/GST/total.
- Browser: 14 checks — no signup tab, admin lacks Add-employee & Equipment nav, manager has
  Add-employee, estimations list + modal with availability + live total, inventory page — zero errors.

---

# 📦 v2.6.2 — Fix: completed items no longer show "overdue"

**Date:** 13 Aug 2026
**Reported:** a project/task completed on its final date was still showing "overdue".

## Root cause
The code checked the old status `completed` everywhere, but the pipeline uses `delivered`
as the finished state — so delivered projects were counted as *active*, never as
*completed*, and the frontend showed overdue based only on the deadline date.

## Fixed
- **Project cards**: delivered/cancelled/completed projects show "✓ Delivered" / "Cancelled"
  — never an overdue countdown, regardless of the deadline date.
- **Task cards (kanban + detail)**: done tasks show a "Done" chip with a checkmark —
  never overdue, even if the due date is in the past.
- **Dashboard (Spring + Node parity)**: `active_projects` now excludes delivered/cancelled,
  `projects_completed` counts delivered, and "Upcoming deadlines" no longer lists
  delivered projects as overdue.

---

# 📦 v2.6.3 — New "Camera Department" (Photographer, Videographer Sr/Jr, Drone Operator)

**Date:** 13 Aug 2026
**Requested:** another department in Employees — Camera Department with Photographer,
Videographer (Sr/Jr) and Drone Operator.

## What changed
- **Department dropdown** (add/edit employee) now includes **Camera Department**.
- **Seed data**: 4 new demo employees in the Camera Department (role: production):
  Ravi Kumar (Photographer), Neha Desai (Videographer Sr), Karan Malhotra (Videographer Jr),
  Jai Prakash (Drone Operator). Total demo team: **24**.
- **Tasks**: 5 shoot tasks assigned to the camera crew (ceremony coverage, gimbal B-roll,
  drone flights) so they appear on the board. Total tasks: 33.
- **Login page**: 4 new demo-account chips (Photographer, Videographer Sr, Videographer Jr,
  Drone Operator) — now 24 chips; team count updated.

## Verified
- 24 employees seeded; Camera Department shows the 4 positions; camera-crew tasks visible;
  employees header "24 members"; demo chips include the new positions — zero errors.
