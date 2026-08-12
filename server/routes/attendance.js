/**
 * Attendance routes — check-in / check-out + history.
 * Staff see their own; HR/admin/owner see everyone.
 */
const express = require('express');
const { authRequired, requirePerm, hasPerm } = require('../auth');
const { logActivity } = require('../db');

const router = express.Router();
router.use(authRequired);

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

router.get('/', requirePerm('projects.view'), (req, res) => {
  const db = req.app.locals.db;
  const { from, to, user_id } = req.query;
  const where = [];
  const params = [];
  const isPrivileged = hasPerm(req.user.role, 'attendance.view_all');
  if (!isPrivileged) { where.push('a.user_id = ?'); params.push(req.user.id); }
  if (user_id && isPrivileged) { where.push('a.user_id = ?'); params.push(Number(user_id)); }
  if (from) { where.push('a.date >= ?'); params.push(from); }
  if (to) { where.push('a.date <= ?'); params.push(to); }
  const sql = `SELECT a.*, u.name AS user_name, u.avatar_hue AS user_hue, u.department
    FROM attendance a LEFT JOIN users u ON u.id = a.user_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.date DESC, u.name`;
  res.json(db.prepare(sql).all(...params));
});

/** Check in (or out) for today. */
router.post('/check', requirePerm('attendance.checkin'), (req, res) => {
  const db = req.app.locals.db;
  const { action } = req.body || {};
  const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, today());
  if (action === 'in') {
    if (existing && existing.check_in) return res.status(400).json({ error: 'Already checked in today' });
    if (existing) {
      db.prepare('UPDATE attendance SET check_in = ? WHERE id = ?').run(nowTime(), existing.id);
      return res.json(db.prepare('SELECT * FROM attendance WHERE id = ?').get(existing.id));
    }
    const info = db.prepare('INSERT INTO attendance (user_id, date, check_in, status) VALUES (?, ?, ?, ?)')
      .run(req.user.id, today(), nowTime(), nowTime() > '10:00' ? 'late' : 'present');
    logActivity(req.user.id, 'checked in', 'attendance', info.lastInsertRowid, `${req.user.name} checked in at ${nowTime()}`);
    return res.status(201).json(db.prepare('SELECT * FROM attendance WHERE id = ?').get(info.lastInsertRowid));
  }
  if (action === 'out') {
    if (!existing || !existing.check_in) return res.status(400).json({ error: 'Check in before checking out' });
    if (existing.check_out) return res.status(400).json({ error: 'Already checked out today' });
    db.prepare('UPDATE attendance SET check_out = ? WHERE id = ?').run(nowTime(), existing.id);
    logActivity(req.user.id, 'checked out', 'attendance', existing.id, `${req.user.name} checked out at ${nowTime()}`);
    return res.json(db.prepare('SELECT * FROM attendance WHERE id = ?').get(existing.id));
  }
  res.status(400).json({ error: 'Action must be "in" or "out"' });
});

module.exports = router;
