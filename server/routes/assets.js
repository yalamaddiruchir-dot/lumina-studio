/**
 * Media asset routes — CRUD (metadata-driven media library).
 */
const express = require('express');
const { authRequired, requirePerm } = require('../auth');
const { logActivity } = require('../db');

const router = express.Router();
router.use(authRequired);

router.get('/', requirePerm('assets.view'), (req, res) => {
  const db = req.app.locals.db;
  const { type, project_id, q } = req.query;
  const where = [];
  const params = [];
  if (req.user.role === 'staff') {
    where.push(`(p.manager_id = ? OR a.project_id IN (SELECT DISTINCT project_id FROM tasks WHERE assignee_id = ?))`);
    params.push(req.user.id, req.user.id);
  }
  if (type) { where.push('a.type = ?'); params.push(type); }
  if (project_id) { where.push('a.project_id = ?'); params.push(Number(project_id)); }
  if (q) { where.push('a.name LIKE ?'); params.push(`%${q}%`); }
  const sql = `SELECT a.*, u.name AS uploader_name, p.name AS project_name
    FROM assets a
    LEFT JOIN users u ON u.id = a.uploaded_by
    LEFT JOIN projects p ON p.id = a.project_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.uploaded_at DESC`;
  res.json(db.prepare(sql).all(...params));
});

router.post('/', requirePerm('assets.upload'), (req, res) => {
  const db = req.app.locals.db;
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Asset name is required' });
  const info = db.prepare(`INSERT INTO assets (name, type, project_id, uploaded_by, size_mb, hue, tags, description, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    name, body.type || 'document', body.project_id || null, req.user.id,
    Number(body.size_mb) || 0, Math.floor(Math.random() * 360),
    body.tags || null, body.description || null, body.url || null
  );
  const row = db.prepare(`SELECT a.*, u.name AS uploader_name, p.name AS project_name FROM assets a
    LEFT JOIN users u ON u.id = a.uploaded_by LEFT JOIN projects p ON p.id = a.project_id
    WHERE a.id = ?`).get(info.lastInsertRowid);
  logActivity(req.user.id, 'uploaded', 'asset', row.id, `Uploaded ${row.name}`);
  res.status(201).json(row);
});

router.put('/:id', requirePerm('assets.upload'), (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Asset not found' });
  const body = req.body || {};
  db.prepare(`UPDATE assets SET name=?, type=?, project_id=?, size_mb=?, tags=?, description=?, url=? WHERE id=?`).run(
    body.name !== undefined ? String(body.name).trim() : existing.name,
    body.type || existing.type,
    body.project_id !== undefined ? (body.project_id || null) : existing.project_id,
    body.size_mb !== undefined ? Number(body.size_mb) : existing.size_mb,
    body.tags !== undefined ? body.tags : existing.tags,
    body.description !== undefined ? body.description : existing.description,
    body.url !== undefined ? body.url : existing.url,
    existing.id
  );
  const row = db.prepare(`SELECT a.*, u.name AS uploader_name, p.name AS project_name FROM assets a
    LEFT JOIN users u ON u.id = a.uploaded_by LEFT JOIN projects p ON p.id = a.project_id WHERE a.id = ?`).get(existing.id);
  logActivity(req.user.id, 'updated', 'asset', row.id, `Updated asset ${row.name}`);
  res.json(row);
});

router.delete('/:id', requirePerm('assets.delete'), (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Asset not found' });
  db.prepare('DELETE FROM assets WHERE id = ?').run(row.id);
  logActivity(req.user.id, 'removed', 'asset', row.id, `Removed asset ${row.name}`);
  res.json({ ok: true });
});

module.exports = router;
