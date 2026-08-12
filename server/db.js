/**
 * Database layer — SQLite with a universal adapter.
 *
 * 1. Uses Node's built-in `node:sqlite` (Node ≥ 22.5) when available — zero native
 *    dependencies, so it works on any modern Node (e.g. Node 26 on macOS) with no
 *    compilation needed.
 * 2. Falls back to `better-sqlite3` (kept as an optionalDependency) on older Node
 *    versions where `node:sqlite` does not exist.
 *
 * Creates the schema on first run and exposes prepared helpers.
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'lumina.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

let db;

function openNativeSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  const raw = new DatabaseSync(DB_PATH);

  // StatementSync normalizes lastInsertRowid to a Number (can be BigInt in some versions)
  const wrapStmt = (stmt) => ({
    run: (...args) => {
      const info = stmt.run(...args);
      return { changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) };
    },
    get: (...args) => stmt.get(...args),
    all: (...args) => stmt.all(...args),
  });

  return {
    exec: (sql) => raw.exec(sql),
    prepare: (sql) => wrapStmt(raw.prepare(sql)),
    pragma: (p) => raw.exec(`PRAGMA ${p};`),
    close: () => raw.close(),
  };
}

function openBetterSqlite() {
  const Database = require('better-sqlite3');
  return new Database(DB_PATH);
}

try {
  db = openNativeSqlite();
  console.log('[db] using built-in node:sqlite');
} catch (e) {
  try {
    db = openBetterSqlite();
    console.log('[db] node:sqlite unavailable — using better-sqlite3');
  } catch (e2) {
    console.error('[db] No SQLite driver available.', e.message, e2.message);
    process.exit(1);
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  department TEXT,
  position TEXT,
  phone TEXT,
  location TEXT,
  bio TEXT,
  skills TEXT,
  salary INTEGER DEFAULT 0,
  hire_date TEXT,
  status TEXT DEFAULT 'active',
  avatar_hue INTEGER DEFAULT 210,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  industry TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  hue INTEGER DEFAULT 160,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'video',
  status TEXT DEFAULT 'planning',
  priority TEXT DEFAULT 'medium',
  budget REAL DEFAULT 0,
  spent REAL DEFAULT 0,
  start_date TEXT,
  deadline TEXT,
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  description TEXT,
  progress INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  due_date TEXT,
  estimated_hours REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'document',
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  size_mb REAL DEFAULT 0,
  hue INTEGER DEFAULT 200,
  tags TEXT,
  description TEXT,
  url TEXT,
  uploaded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timesheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  hours REAL DEFAULT 0,
  description TEXT,
  status TEXT DEFAULT 'pending',
  submitted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT DEFAULT 'present'
);

CREATE TABLE IF NOT EXISTS payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  base_salary REAL DEFAULT 0,
  bonus REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  net REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_user ON timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_user ON payroll(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at);
`);

// WAL + foreign keys (better-sqlite3: pragma() returns a row; node:sqlite: exec)
try {
  db.pragma('journal_mode = WAL');
} catch (e) { /* WAL is best-effort */ }
db.pragma('foreign_keys = ON');

/** Log an activity entry. */
function logActivity(userId, action, targetType, targetId, details) {
  db.prepare(
    'INSERT INTO activity (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
  ).run(userId || null, action, targetType || null, targetId || null, details || null);
}

/** True when the database has not been seeded yet. */
const isFresh = () => {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  return row.c === 0;
};

module.exports = { db, logActivity, isFresh, DB_PATH };
