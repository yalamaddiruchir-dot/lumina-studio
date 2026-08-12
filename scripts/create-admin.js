/**
 * Create a real user account from the CLI.
 *
 * Use this in production to create the first (or additional) accounts when
 * demo seeding is disabled (SEED_DEMO=false).
 *
 * Usage:
 *   npm run create:admin -- --name "Jane Doe" --email jane@company.com --password 'S3cure!pass' [--role admin]
 *
 * Environment-variable equivalents: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_ROLE
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('../server/db');
const { ROLE_LABELS } = require('../server/config');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const name = arg('name', process.env.ADMIN_NAME || '').trim();
const email = arg('email', process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = arg('password', process.env.ADMIN_PASSWORD || '');
const role = arg('role', process.env.ADMIN_ROLE || 'admin').trim();

if (!name || !email || !password) {
  console.error('Usage: npm run create:admin -- --name "Jane Doe" --email jane@company.com --password "..." [--role admin]');
  console.error('  (or set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_ROLE env vars)');
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`Invalid email: "${email}"`);
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}
if (!ROLE_LABELS[role]) {
  console.error(`Invalid role "${role}". Valid roles: ${Object.keys(ROLE_LABELS).join(', ')}`);
  process.exit(1);
}

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  console.error(`An account already exists for ${email}.`);
  process.exit(1);
}

const info = db.prepare(`INSERT INTO users (name, email, password_hash, role, status, avatar_hue)
  VALUES (?, ?, ?, ?, 'active', ?)`).run(
  name, email, bcrypt.hashSync(password, 10), role, Math.floor(Math.random() * 360)
);

console.log(`✅ Created account  #${info.lastInsertRowid}`);
console.log(`   Name:    ${name}`);
console.log(`   Email:   ${email}`);
console.log(`   Role:    ${role} (${ROLE_LABELS[role]})`);
console.log(`   Status:  active`);
console.log('Please make sure the person changes this password on first login.');
