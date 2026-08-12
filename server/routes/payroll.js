/**
 * Payroll routes — finance/owner manage, admin views.
 */
const express = require('express');
const { authRequired, requirePerm } = require('../auth');
const { logActivity } = require('../db');

const router = express.Router();
router.use(authRequired);

router.get('/', requirePerm('payroll.view'), (req, res) => {
  const db = req.app.locals.db;
  const { month } = req.query;
  const rows = db.prepare(`
    SELECT py.*, u.name AS user_name, u.role, u.department, u.avatar_hue
    FROM payroll py JOIN users u ON u.id = py.user_id
    ${month ? 'WHERE py.month = ?' : ''}
    ORDER BY py.month DESC, u.name`).all(...(month ? [month] : []));
  const months = db.prepare('SELECT DISTINCT month FROM payroll ORDER BY month DESC').all().map((r) => r.month);
  res.json({ rows, months });
});

router.patch('/:id/status', requirePerm('payroll.manage'), (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT * FROM payroll WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Payroll record not found' });
  const { status } = req.body || {};
  if (!['draft', 'paid'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE payroll SET status = ?, paid_at = CASE WHEN ? = 'paid' THEN datetime('now') ELSE NULL END WHERE id = ?`)
    .run(status, status, row.id);
  const updated = db.prepare(`SELECT py.*, u.name AS user_name, u.role, u.department FROM payroll py JOIN users u ON u.id = py.user_id WHERE py.id = ?`).get(row.id);
  logActivity(req.user.id, status, 'payroll', row.id, `${status === 'paid' ? 'Marked paid' : 'Returned to draft'}: ${updated.user_name} — ${updated.month}`);
  res.json(updated);
});

module.exports = router;
