/**
 * Employee routes — CRUD with role-based gating.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { authRequired, requirePerm } = require('../auth');
const { logActivity } = require('../db');
const { serializeUser } = require('./auth');

const router = express.Router();
router.use(authRequired);

const EMPLOYEE_FIELDS = ['name', 'email', 'role', 'department', 'position', 'phone', 'location', 'bio', 'skills', 'salary', 'hire_date', 'status', 'avatar_hue'];

/** Access-control matrix for the "Access Control" page (owner/admin). */
router.get('/meta/roles', requirePerm('access.view'), (req, res) => {
  const { ROLE_LABELS, ROLE_LEVELS, CAPABILITIES, ROLE_PERMISSIONS } = require('../config');
  res.json({
    levels: ROLE_LEVELS,
    labels: ROLE_LABELS,
    capabilities: Object.values(CAPABILITIES),
    matrix: ROLE_PERMISSIONS,
  });
});

router.get('/', requirePerm('employees.view'), (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status != 'done') AS open_tasks,
      (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id) AS total_tasks,
      (SELECT COUNT(*) FROM projects p WHERE p.manager_id = u.id) AS managed_projects
    FROM users u ORDER BY
      CASE u.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'hr' THEN 3 WHEN 'finance' THEN 4 ELSE 5 END,
      u.name
  `).all();
  res.json(rows.map((r) => serializeUser(r, req.user.role)));
});

router.get('/:id', requirePerm('employees.view'), (req, res) => {
  const row = req.app.locals.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Employee not found' });
  res.json(serializeUser(row, req.user.role));
});

router.post('/', requirePerm('employees.manage'), (req, res) => {
  const db = req.app.locals.db;
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }
  const info = db.prepare(`INSERT INTO users (name, email, password_hash, role, department, position, phone, location, bio, skills, salary, hire_date, status, avatar_hue)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    name, email, bcrypt.hashSync(body.password || 'demo123', 10),
    body.role || 'staff', body.department || null, body.position || null,
    body.phone || null, body.location || null, body.bio || null, body.skills || null,
    Math.round(Number(body.salary) || 0), body.hire_date || null,
    body.status || 'active', Math.floor(Math.random() * 360)
  );
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  logActivity(req.user.id, 'added', 'employee', row.id, `Added ${row.name} as ${row.position || row.role}`);
  res.status(201).json(serializeUser(row, req.user.role));
});

router.put('/:id', requirePerm('employees.manage'), (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Employee not found' });
  const body = req.body || {};
  const email = String(body.email !== undefined ? body.email : existing.email).trim().toLowerCase();
  const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, existing.id);
  if (dup) return res.status(400).json({ error: 'Another account already uses this email' });

  const next = {
    name: body.name !== undefined ? String(body.name).trim() : existing.name,
    email,
    role: body.role || existing.role,
    department: body.department !== undefined ? body.department : existing.department,
    position: body.position !== undefined ? body.position : existing.position,
    phone: body.phone !== undefined ? body.phone : existing.phone,
    location: body.location !== undefined ? body.location : existing.location,
    bio: body.bio !== undefined ? body.bio : existing.bio,
    skills: body.skills !== undefined ? body.skills : existing.skills,
    salary: body.salary !== undefined ? Math.round(Number(body.salary) || 0) : existing.salary,
    hire_date: body.hire_date !== undefined ? body.hire_date : existing.hire_date,
    status: body.status || existing.status,
  };
  db.prepare(`UPDATE users SET name=?, email=?, role=?, department=?, position=?, phone=?, location=?, bio=?, skills=?, salary=?, hire_date=?, status=? WHERE id=?`).run(
    next.name, next.email, next.role, next.department, next.position, next.phone,
    next.location, next.bio, next.skills, next.salary, next.hire_date, next.status, existing.id
  );
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
  logActivity(req.user.id, 'updated', 'employee', row.id, `Updated ${row.name}`);
  res.json(serializeUser(row, req.user.role));
});

router.delete('/:id', requirePerm('employees.delete'), (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Employee not found' });
  if (row.role === 'owner') return res.status(400).json({ error: 'The owner account cannot be removed' });
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(row.id);
  logActivity(req.user.id, 'removed', 'employee', row.id, `Removed ${row.name}`);
  res.json({ ok: true });
});

module.exports = router;
