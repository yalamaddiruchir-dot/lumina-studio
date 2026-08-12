/**
 * Lumina Studios — config: roles, access levels & permission matrix.
 * Every role maps to an "access level" and a set of capabilities.
 *
 * Environment variables (see .env.example):
 *   NODE_ENV        development | production            (default: development)
 *   PORT            HTTP port                            (default: 3001)
 *   JWT_SECRET      REQUIRED in production — token signing key
 *   CORS_ORIGINS    comma-separated allowed origins (production; empty = same-origin only)
 *   SEED_DEMO       "true" (default) seeds demo accounts on a fresh DB; set "false" in production
 *   BACKUP_DIR      where `npm run backup` writes snapshots (default: backups/)
 */

require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3001;
const JWT_EXPIRES = '7d';

// In production the JWT secret MUST come from the environment — never a hardcoded fallback.
const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'production' ? null : 'lumina-studio-dev-secret-2026');
if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[config] Fatal: JWT_SECRET must be set in production. Generate one with: openssl rand -hex 32');
  process.exit(1);
}

/** Comma-separated list of allowed CORS origins (production). Empty = same-origin only. */
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** When true (default), a fresh database is auto-seeded with demo accounts. Never enable this in production. */
const SEED_DEMO = process.env.SEED_DEMO !== 'false';

const BACKUP_DIR = process.env.BACKUP_DIR || 'backups';

/** Access level (higher = more access) — wedding/album studio org chart */
const ROLE_LEVELS = {
  owner: 5,
  admin: 4,
  manager: 3,
  hr: 3,
  finance: 3,
  sales: 2,
  quality: 2,
  production: 1,
};

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'System Admin',
  manager: 'Manager',
  hr: 'HR / Admin',
  finance: 'Finance',
  sales: 'Sales',
  quality: 'Quality Control',
  production: 'Production',
};

/** Production pipeline: booked → data_copy → lightroom → video → album → final_review → delivered */
const PIPELINE = ['booked', 'data_copy', 'lightroom', 'video', 'album', 'final_review', 'delivered'];

/** Capabilities available in the app. */
const CAPABILITIES = {
  dashboard: { key: 'dashboard.view', label: 'View dashboard' },
  employeesView: { key: 'employees.view', label: 'View employees' },
  employeesManage: { key: 'employees.manage', label: 'Add / edit employees' },
  employeesDelete: { key: 'employees.delete', label: 'Remove employees' },
  salaryView: { key: 'salary.view', label: 'View salaries' },
  clientsView: { key: 'clients.view', label: 'View clients' },
  clientsManage: { key: 'clients.manage', label: 'Add / edit / remove clients' },
  projectsView: { key: 'projects.view', label: 'View projects' },
  projectsManage: { key: 'projects.manage', label: 'Create / edit projects' },
  projectsDelete: { key: 'projects.delete', label: 'Delete projects' },
  tasksViewAll: { key: 'tasks.view_all', label: 'View all tasks' },
  tasksManage: { key: 'tasks.manage', label: 'Create / edit / delete tasks' },
  tasksOwn: { key: 'tasks.own', label: 'Update own tasks' },
  assetsView: { key: 'assets.view', label: 'View media assets' },
  assetsUpload: { key: 'assets.upload', label: 'Upload assets' },
  assetsDelete: { key: 'assets.delete', label: 'Delete assets' },
  timesheetsViewAll: { key: 'timesheets.view_all', label: 'View all timesheets' },
  timesheetsSubmit: { key: 'timesheets.submit', label: 'Submit timesheets' },
  timesheetsApprove: { key: 'timesheets.approve', label: 'Approve / reject timesheets' },
  attendanceViewAll: { key: 'attendance.view_all', label: 'View all attendance' },
  attendanceCheckin: { key: 'attendance.checkin', label: 'Check in / out' },
  payrollView: { key: 'payroll.view', label: 'View payroll' },
  payrollManage: { key: 'payroll.manage', label: 'Process / mark payroll paid' },
  activityView: { key: 'activity.view', label: 'View activity log' },
  accessView: { key: 'access.view', label: 'View access control matrix' },
};

/** Role → capabilities matrix. */
const ROLE_PERMISSIONS = {
  owner: Object.values(CAPABILITIES).map((c) => c.key),

  admin: [
    'dashboard.view', 'employees.view', 'employees.manage', 'employees.delete',
    'salary.view', 'clients.view', 'clients.manage', 'projects.view',
    'projects.manage', 'projects.delete', 'pipeline.advance', 'tasks.view_all', 'tasks.manage',
    'assets.view', 'assets.upload', 'assets.delete', 'timesheets.view_all',
    'timesheets.submit', 'timesheets.approve', 'attendance.view_all',
    'attendance.checkin', 'payroll.view', 'activity.view', 'access.view',
  ],

  manager: [
    'dashboard.view', 'employees.view', 'clients.view', 'clients.manage',
    'projects.view', 'projects.manage', 'projects.delete', 'pipeline.advance', 'tasks.view_all',
    'tasks.manage', 'assets.view', 'assets.upload', 'assets.delete',
    'timesheets.view_all', 'timesheets.submit', 'timesheets.approve',
    'attendance.checkin', 'activity.view',
  ],

  hr: [
    'dashboard.view', 'employees.view', 'employees.manage', 'employees.delete',
    'salary.view', 'clients.view', 'projects.view', 'tasks.view_all',
    'assets.view', 'timesheets.view_all', 'timesheets.submit',
    'attendance.view_all', 'attendance.checkin', 'activity.view',
  ],

  finance: [
    'dashboard.view', 'employees.view', 'salary.view', 'clients.view',
    'projects.view', 'tasks.view_all', 'assets.view', 'timesheets.view_all',
    'timesheets.submit', 'timesheets.approve', 'attendance.view_all',
    'payroll.view', 'payroll.manage', 'activity.view',
  ],

  sales: [
    'dashboard.view', 'clients.view', 'clients.manage', 'projects.view',
    'projects.manage', 'tasks.own', 'assets.view', 'timesheets.submit',
    'attendance.checkin',
  ],

  quality: [
    'dashboard.view', 'projects.view', 'pipeline.advance', 'tasks.own',
    'assets.view', 'assets.upload', 'timesheets.submit', 'attendance.checkin',
  ],

  production: [
    'dashboard.view', 'projects.view', 'tasks.own', 'assets.view',
    'assets.upload', 'timesheets.submit', 'attendance.checkin',
  ],
};

const hasPerm = (role, perm) => {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(perm) || (ROLE_LEVELS[role] === 5);
};

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES,
  PORT,
  NODE_ENV,
  CORS_ORIGINS,
  SEED_DEMO,
  BACKUP_DIR,
  ROLE_LEVELS,
  ROLE_LABELS,
  CAPABILITIES,
  ROLE_PERMISSIONS,
  hasPerm,
};
