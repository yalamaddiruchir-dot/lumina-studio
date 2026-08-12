/**
 * Timesheet routes — staff submit, managers/HR/finance approve.
 */
const express = require('express');
const { authRequired, requirePerm, hasPerm } = require('../auth');
const { logActivity } = require('../db');

const router = express.Router();
router.use(authRequired);

router.get('/', requirePerm('projects.view'), (req, res) => {
  const db = req.app.locals.db;
  const { status, user_id, from, to } = req.query;
  const where = [];
  const params = [];
  if (req.user.role === 'staff') {
    where.push('ts.user_id = ?');
    params.push(req.user.id);
  }
  if (status) { where.push('ts.status = ?'); params.push(status); }
  if (user_id) { where.push('ts.user_id = ?'); params.push(Number(user_id)); }
  if (from) { where.push('ts.date >= ?'); params.push(from); }
  if (to) { where.push('ts.date <= ?'); params.push(to); }
  const sql = `SELECT ts.*, u.name AS user_name, u.avatar_hue AS user_hue, u.department, p.name AS project_name
    FROM timesheets ts
    LEFT JOIN users u ON u.id = ts.user_id
    LEFT JOIN projects p ON p.id = ts.project_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ts.date DESC, ts.id DESC`;
  res.json(db.prepare(sql).all(...params));
});

router.post('/', requirePerm('timesheets.submit'), (req, res) => {
  const db = req.app.locals.db;
  const body = req.body || {};
  const date = body.date;
  const hours = Number(body.hours) || 0;
  if (!date) return res.status(400).json({ error: 'Date is required' });
  if (hours <= 0 || hours > 24) return res.status(400).json({ error: 'Hours must be between 0 and 24' });
  const info = db.prepare(`INSERT INTO timesheets (user_id, project_id, date, hours, description, status)
    VALUES (?, ?, ?, ?, ?, 'pending')`).run(
    req.user.id, body.project_id || null, date, hours, body.description || null
  );
  const row = db.prepare(`SELECT ts.*, u.name AS user_name, u.avatar_hue AS user_hue, p.name AS project_name
    FROM timesheets ts LEFT JOIN users u ON u.id = ts.user_id LEFT JOIN projects p ON p.id = ts.project_id
    WHERE ts.id = ?`).get(info.lastInsertRowid);
  logActivity(req.user.id, 'submitted', 'timesheet', row.id, `Submitted ${hours}h timesheet for ${date}`);
  res.status(201).json(row);
});

router.patch('/:id/status', requirePerm('timesheets.approve'), (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT * FROM timesheets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Timesheet not found' });
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE timesheets SET status = ? WHERE id = ?').run(status, row.id);
  logActivity(req.user.id, status, 'timesheet', row.id, `${status[0].toUpperCase() + status.slice(1)} a timesheet for ${row.date}`);
  const updated = db.prepare(`SELECT ts.*, u.name AS user_name, u.avatar_hue AS user_hue, p.name AS project_name
    FROM timesheets ts LEFT JOIN users u ON u.id = ts.user_id LEFT JOIN projects p ON p.id = ts.project_id
    WHERE ts.id = ?`).get(row.id);
  res.json(updated);
});

router.delete('/:id', requirePerm('timesheets.submit'), (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT * FROM timesheets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Timesheet not found' });
  if (row.user_id !== req.user.id && !requirePermCheck(req.user.role)) {
    return res.status(403).json({ error: 'You can only delete your own timesheets' });
  }
  db.prepare('DELETE FROM timesheets WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

function requirePermCheck(role) {
  return hasPerm(role, 'timesheets.approve');
}

module.exports = router;
