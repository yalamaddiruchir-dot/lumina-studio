/**
 * Dashboard — single aggregate endpoint, role-aware.
 */
const express = require('express');
const { authRequired } = require('../auth');
const { hasPerm } = require('../config');

const router = express.Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const me = req.user;
  const isStaff = me.role === 'staff';
  const today = new Date().toISOString().slice(0, 10);

  const staffScopeTask = isStaff ? 'AND (assignee_id = ? OR assignee_id IS NULL)' : '';
  const staffParams = isStaff ? [me.id] : [];
  const staffScopeProj = isStaff
    ? 'AND (p.manager_id = ? OR p.id IN (SELECT DISTINCT project_id FROM tasks WHERE assignee_id = ?))'
    : '';
  const staffProjParams = isStaff ? [me.id, me.id] : [];

  const stats = {};
  stats.active_projects = db.prepare(`SELECT COUNT(*) c FROM projects p WHERE p.status != 'completed' ${staffScopeProj}`).get(...staffProjParams).c;
  stats.open_tasks = db.prepare(`SELECT COUNT(*) c FROM tasks t WHERE t.status != 'done' ${staffScopeTask}`).get(...staffParams).c;
  stats.my_due_tasks = db.prepare(`SELECT COUNT(*) c FROM tasks t WHERE t.status != 'done' AND t.assignee_id = ? AND t.due_date <= ?`).get(me.id, today).c;
  stats.pending_timesheets = hasPerm(me.role, 'timesheets.approve')
    ? db.prepare(`SELECT COUNT(*) c FROM timesheets WHERE status = 'pending'`).get().c
    : db.prepare(`SELECT COUNT(*) c FROM timesheets WHERE status = 'pending' AND user_id = ?`).get(me.id).c;
  stats.headcount = db.prepare(`SELECT COUNT(*) c FROM users WHERE status = 'active'`).get().c;
  stats.active_clients = db.prepare(`SELECT COUNT(*) c FROM clients WHERE status = 'active'`).get().c;
  stats.projects_completed = db.prepare(`SELECT COUNT(*) c FROM projects p WHERE p.status = 'completed' ${staffScopeProj}`).get(...staffProjParams).c;

  const status_dist = db.prepare(`SELECT status, COUNT(*) c FROM projects p WHERE 1=1 ${staffScopeProj} GROUP BY status`).all(...staffProjParams);

  const budget_vs_spent = db.prepare(`SELECT name, budget, spent FROM projects p WHERE 1=1 ${staffScopeProj} ORDER BY budget DESC LIMIT 7`).all(...staffProjParams);

  // Tasks completed per day, last 14 days
  const dayMap = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dayMap[d.toISOString().slice(0, 10)] = 0;
  }
  const completed = db.prepare(`SELECT date(completed_at) d, COUNT(*) c FROM tasks WHERE completed_at IS NOT NULL AND date(completed_at) >= ? GROUP BY d`)
    .all(daysAgo14());
  completed.forEach((r) => { if (r.d in dayMap) dayMap[r.d] = r.c; });
  const tasks_14d = Object.entries(dayMap).map(([d, c]) => ({ date: d.slice(5), count: c }));

  const upcoming = db.prepare(`SELECT p.id, p.name, p.deadline, p.priority, p.progress, c.name AS client_name
    FROM projects p LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.status != 'completed' AND p.deadline IS NOT NULL ${staffScopeProj.replace(/p\./g, 'p.')}
    ORDER BY p.deadline ASC LIMIT 6`).all(...staffProjParams);

  const activity = db.prepare(`SELECT a.id, a.action, a.details, a.created_at, u.name AS user_name, u.avatar_hue
    FROM activity a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 9`).all();

  const workload = db.prepare(`SELECT u.id, u.name, u.avatar_hue, u.department, COUNT(t.id) open
    FROM users u JOIN tasks t ON t.assignee_id = u.id AND t.status != 'done'
    GROUP BY u.id ORDER BY open DESC LIMIT 6`).all();

  const myHoursThisWeek = db.prepare(`SELECT COALESCE(SUM(hours),0) h FROM timesheets WHERE user_id = ? AND date >= date('now', '-7 days')`).get(me.id).h;
  const myPending = db.prepare(`SELECT COUNT(*) c FROM timesheets WHERE user_id = ? AND status = 'pending'`).get(me.id).c;

  res.json({ stats, status_dist, budget_vs_spent, tasks_14d, upcoming, activity, workload, myHoursThisWeek, myPending });
});

function daysAgo14() {
  const d = new Date(); d.setDate(d.getDate() - 14);
  return d.toISOString().slice(0, 10);
}

module.exports = router;
