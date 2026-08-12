/**
 * Consistent SQLite backup via `VACUUM INTO`.
 *
 * Produces a single-file transactional snapshot of the database while the server
 * is running (safe during writes), then prunes old snapshots.
 *
 * Usage:
 *   npm run backup
 *
 * Env: BACKUP_DIR (default: backups/), BACKUP_KEEP (default: 30)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db } = require('../server/db');
const { BACKUP_DIR } = require('../server/config');

const KEEP = Number(process.env.BACKUP_KEEP) || 30;

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date()
  .toISOString()               // e.g. 2026-08-10T19:02:48.123Z
  .replace(/[:T]/g, '-')       // → 2026-08-10-19-02-48.123Z (milliseconds kept ⇒ unique per run)
  .replace(/Z$/, '');
const target = path.join(BACKUP_DIR, `lumina-${stamp}.db`);

// VACUUM INTO writes a consistent snapshot to a new file (path is generated
// internally — safe to interpolate; single quotes escaped defensively).
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

const sizeMb = (fs.statSync(target).size / 1024 / 1024).toFixed(2);
console.log(`💾 Backup written: ${target} (${sizeMb} MB)`);

// Prune old backups, keep the newest KEEP.
const backups = fs
  .readdirSync(BACKUP_DIR)
  .filter((f) => /^lumina-.*\.db$/.test(f))
  .sort()
  .reverse();
const remove = backups.slice(KEEP);
for (const f of remove) {
  fs.rmSync(path.join(BACKUP_DIR, f));
  console.log(`   pruned: ${f}`);
}
console.log(`   kept ${Math.min(backups.length, KEEP)} snapshot(s) in ${BACKUP_DIR}/`);
