/**
 * Project routes — CRUD with role scoping.
 * Staff see projects they manage or have tasks on; everyone else sees all.
 */
const express = require('express');
const { authRequired, requirePerm } = require('../auth');
const { logActivity } = require('../db');

const router = express.Router();
router.use(authRequired);

const PROJECT_SELECT = `
  SELECT p.*, c.name AS client_name, c.company AS client_company, c.hue AS client_hue,
    m.name AS manager_name,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_tasks,
    (SELECT COUNT(*) FROM assets a WHERE a.project_id = p.id) AS asset_count
  FROM projects p
  LEFT JOIN clients c ON c.id = p.client_id
  LEFT JOIN users m ON m.id = p.manager_id`;

function scopedProjectsSQL(user) {
  if (user.role === 'staff') {
    return `${PROJECT_SELECT}
      WHERE p.manager_id = ? OR p.id IN (SELECT DISTINCT project_id FROM tasks WHERE assignee_id = ?)
      ORDER BY p.deadline IS NULL, p.deadline ASC`;
  }
  return `${PROJECT_SELECT} ORDER BY p.created_at DESC`;
}

router.get('/', requirePerm('projects.view'), (req, res) => {
  res.json(listProjects(req.app.locals.db, req.user));
});

function listProjects(db, user) {
  if (user.role === 'staff') {
    return db.prepare(scopedProjectsSQL(user)).all(user.id, user.id);
  }
  return db.prepare(scopedProjectsSQL(user)).all();
}

router.get('/:id', requirePerm('projects.view'), (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'staff') {
    const isManager = row.manager_id === req.user.id;
    const onTeam = db.prepare('SELECT 1 FROM tasks WHERE project_id = ? AND assignee_id = ?').get(row.id, req.user.id);
    if (!isManager && !onTeam) return res.status(403).json({ error: 'You are not on this project team' });
  }
  const tasks = db.prepare(`SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ? ORDER BY CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 ELSE 3 END, t.due_date IS NULL, t.due_date`).all(row.id);
  const assets = db.prepare(`SELECT a.*, u.name AS uploader_name FROM assets a LEFT JOIN users u ON u.id = a.uploaded_by
    WHERE a.project_id = ? ORDER BY a.uploaded_at DESC`).all(row.id);
  const team = db.prepare(`SELECT DISTINCT u.id, u.name, u.role, u.department, u.position, u.avatar_hue
    FROM users u JOIN tasks t ON t.assignee_id = u.id WHERE t.project_id = ?`).all(row.id);
  res.json({ ...row, tasks, assets, team });
});

router.post('/', requirePerm('projects.manage'), (req, res) => {
  const db = req.app.locals.db;
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Project name is required' });
  const info = db.prepare(`INSERT INTO projects
    (name, client_id, type, status, priority, budget, spent, start_date, deadline, manager_id, description, progress)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    name, body.client_id || null, body.type || 'video', body.status || 'planning',
    body.priority || 'medium', Number(body.budget) || 0, Number(body.spent) || 0,
    body.start_date || null, body.deadline || null, body.manager_id || null,
    body.description || null, Number(body.progress) || 0
  );
  const row = db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(info.lastInsertRowid);
  logActivity(req.user.id, 'created', 'project', row.id, `Created project '${row.name}'`);
  res.status(201).json(row);
});

router.put('/:id', requirePerm('projects.manage'), (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  const body = req.body || {};
  db.prepare(`UPDATE projects SET name=?, client_id=?, type=?, status=?, priority=?, budget=?, spent=?, start_date=?, deadline=?, manager_id=?, description=?, progress=? WHERE id=?`).run(
    body.name !== undefined ? String(body.name).trim() : existing.name,
    body.client_id !== undefined ? (body.client_id || null) : existing.client_id,
    body.type || existing.type,
    body.status || existing.status,
    body.priority || existing.priority,
    body.budget !== undefined ? Number(body.budget) : existing.budget,
    body.spent !== undefined ? Number(body.spent) : existing.spent,
    body.start_date !== undefined ? body.start_date : existing.start_date,
    body.deadline !== undefined ? body.deadline : existing.deadline,
    body.manager_id !== undefined ? (body.manager_id || null) : existing.manager_id,
    body.description !== undefined ? body.description : existing.description,
    body.progress !== undefined ? Number(body.progress) : existing.progress,
    existing.id
  );
  const row = db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(existing.id);
  logActivity(req.user.id, 'updated', 'project', row.id, `Updated project '${row.name}'`);
  res.json(row);
});

router.delete('/:id', requirePerm('projects.delete'), (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Project not found' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(row.id);
  logActivity(req.user.id, 'removed', 'project', row.id, `Removed project '${row.name}'`);
  res.json({ ok: true });
});

module.exports = router;
