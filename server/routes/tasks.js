/**
 * Task routes — CRUD with role scoping.
 * Staff can update their own task status; managers/above manage all tasks.
 */
const express = require('express');
const { authRequired, requirePerm, hasPerm } = require('../auth');
const { logActivity } = require('../db');

const router = express.Router();
router.use(authRequired);

const TASK_SELECT = `
  SELECT t.*, u.name AS assignee_name, u.avatar_hue AS assignee_hue, u.role AS assignee_role,
    p.name AS project_name, p.type AS project_type
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assignee_id
  LEFT JOIN projects p ON p.id = t.project_id`;

router.get('/', requirePerm('projects.view'), (req, res) => {
  const db = req.app.locals.db;
  const { status, project_id, assignee_id, q } = req.query;
  const where = [];
  const params = [];
  if (req.user.role === 'staff') {
    where.push('t.assignee_id = ?');
    params.push(req.user.id);
  }
  if (status) { where.push('t.status = ?'); params.push(status); }
  if (project_id) { where.push('t.project_id = ?'); params.push(Number(project_id)); }
  if (assignee_id) { where.push('t.assignee_id = ?'); params.push(Number(assignee_id)); }
  if (q) { where.push('(t.title LIKE ? OR t.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const sql = `${TASK_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 ELSE 3 END,
    t.due_date IS NULL, t.due_date, t.created_at DESC`;
  res.json(db.prepare(sql).all(...params));
});

router.post('/', requirePerm('tasks.manage'), (req, res) => {
  const db = req.app.locals.db;
  const body = req.body || {};
  const title = String(body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Task title is required' });
  const info = db.prepare(`INSERT INTO tasks (title, description, project_id, assignee_id, status, priority, due_date, estimated_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    title, body.description || null, body.project_id || null, body.assignee_id || null,
    body.status || 'todo', body.priority || 'medium', body.due_date || null, Number(body.estimated_hours) || 0
  );
  const row = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(info.lastInsertRowid);
  logActivity(req.user.id, 'created', 'task', row.id, `Created task '${row.title}'`);
  res.status(201).json(row);
});

/** Quick status move — supports optimistic UI updates. */
router.patch('/:id/status', (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Task not found' });
  const { status } = req.body || {};
  const valid = ['todo', 'in_progress', 'review', 'done'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const isOwn = row.assignee_id === req.user.id;
  // Staff may only move their own tasks; everyone else needs manage permission.
  const allowed = isOwn ? true : hasPerm(req.user.role, 'tasks.manage');
  if (!allowed) return res.status(403).json({ error: 'Only managers can move other people\'s tasks' });
  db.prepare(`UPDATE tasks SET status = ?, completed_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END WHERE id = ?`)
    .run(status, status, row.id);
  const updated = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(row.id);
  logActivity(req.user.id, status === 'done' ? 'completed' : 'moved', 'task', row.id,
    `${status === 'done' ? 'Completed' : `Moved '${row.title}' to ${status.replace('_', ' ')}`}`);
  res.json(updated);
});

router.put('/:id', requirePerm('tasks.manage'), (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  const body = req.body || {};
  db.prepare(`UPDATE tasks SET title=?, description=?, project_id=?, assignee_id=?, status=?, priority=?, due_date=?, estimated_hours=?
    WHERE id=?`).run(
    body.title !== undefined ? String(body.title).trim() : existing.title,
    body.description !== undefined ? body.description : existing.description,
    body.project_id !== undefined ? (body.project_id || null) : existing.project_id,
    body.assignee_id !== undefined ? (body.assignee_id || null) : existing.assignee_id,
    body.status || existing.status,
    body.priority || existing.priority,
    body.due_date !== undefined ? body.due_date : existing.due_date,
    body.estimated_hours !== undefined ? Number(body.estimated_hours) : existing.estimated_hours,
    existing.id
  );
  const row = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(existing.id);
  logActivity(req.user.id, 'updated', 'task', row.id, `Updated task '${row.title}'`);
  res.json(row);
});

router.delete('/:id', requirePerm('tasks.manage'), (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(row.id);
  logActivity(req.user.id, 'removed', 'task', row.id, `Removed task '${row.title}'`);
  res.json({ ok: true });
});

module.exports = router;
