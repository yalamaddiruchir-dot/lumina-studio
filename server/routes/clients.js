/**
 * Client routes — CRUD.
 */
const express = require('express');
const { authRequired, requirePerm } = require('../auth');
const { logActivity } = require('../db');

const router = express.Router();
router.use(authRequired);

router.get('/', requirePerm('clients.view'), (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) AS project_count,
      (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id AND p.status != 'completed') AS active_projects,
      (SELECT COALESCE(SUM(p.budget), 0) FROM projects p WHERE p.client_id = c.id) AS total_budget
    FROM clients c ORDER BY c.created_at DESC
  `).all();
  res.json(rows);
});

router.post('/', requirePerm('clients.manage'), (req, res) => {
  const db = req.app.locals.db;
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Client name is required' });
  const info = db.prepare(`INSERT INTO clients (name, company, email, phone, industry, status, notes, hue)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    name, body.company || null, body.email || null, body.phone || null,
    body.industry || null, body.status || 'active', body.notes || null,
    Math.floor(Math.random() * 360)
  );
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
  logActivity(req.user.id, 'created', 'client', row.id, `Added client ${row.name}`);
  res.status(201).json(row);
});

router.put('/:id', requirePerm('clients.manage'), (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client not found' });
  const body = req.body || {};
  db.prepare(`UPDATE clients SET name=?, company=?, email=?, phone=?, industry=?, status=?, notes=? WHERE id=?`).run(
    body.name !== undefined ? String(body.name).trim() : existing.name,
    body.company !== undefined ? body.company : existing.company,
    body.email !== undefined ? body.email : existing.email,
    body.phone !== undefined ? body.phone : existing.phone,
    body.industry !== undefined ? body.industry : existing.industry,
    body.status || existing.status,
    body.notes !== undefined ? body.notes : existing.notes,
    existing.id
  );
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(existing.id);
  logActivity(req.user.id, 'updated', 'client', row.id, `Updated client ${row.name}`);
  res.json(row);
});

router.delete('/:id', requirePerm('clients.manage'), (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Client not found' });
  db.prepare('DELETE FROM clients WHERE id = ?').run(row.id);
  logActivity(req.user.id, 'removed', 'client', row.id, `Removed client ${row.name}`);
  res.json({ ok: true });
});

module.exports = router;
