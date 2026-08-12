/**
 * Auth routes — login, current user, change password.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { signToken, authRequired } = require('../auth');
const { logActivity } = require('../db');

const router = express.Router();

// Serializes a user for the client (salary visibility depends on caller role)
function serializeUser(row, viewerRole) {
  const canSeeSalary = ['owner', 'admin', 'hr', 'finance'].includes(viewerRole || row.role);
  const u = {
    id: row.id, name: row.name, email: row.email, role: row.role,
    department: row.department, position: row.position, phone: row.phone,
    location: row.location, bio: row.bio, skills: row.skills,
    hire_date: row.hire_date, status: row.status, avatar_hue: row.avatar_hue,
    created_at: row.created_at,
  };
  if (canSeeSalary) u.salary = row.salary;
  return u;
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = req.app.locals.db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.status === 'inactive') return res.status(403).json({ error: 'This account has been deactivated' });
  const token = signToken(user);
  logActivity(user.id, 'signed in', 'user', user.id, `${user.name} signed in`);
  res.json({ token, user: serializeUser(user, user.role) });
});

router.get('/me', authRequired, (req, res) => {
  const row = req.app.locals.db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json(serializeUser(row, req.user.role));
});

router.post('/change-password', authRequired, (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next || String(next).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const row = req.app.locals.db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current), row.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  req.app.locals.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(String(next), 10), req.user.id);
  logActivity(req.user.id, 'changed', 'password', req.user.id, `${req.user.name} changed their password`);
  res.json({ ok: true });
});

module.exports = { router, serializeUser };
