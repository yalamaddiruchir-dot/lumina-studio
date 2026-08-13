import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Icon } from '../components/icons';
import { Avatar, Badge, Skeleton } from '../components/ui';
import { BudgetBarChart, DonutChart, AreaChart } from '../components/Charts';
import { moneyCompact, relativeTime, daysUntil, formatDateShort } from '../lib/format';

const STATUS_COLORS = {
  booked: '#64748b', data_copy: '#60a5fa', lightroom: '#a78bfa', video: '#f472b6',
  album: '#2dd4bf', final_review: '#fbbf24', delivered: '#10b981', cancelled: '#ef4444',
};

export default function Dashboard() {
  const { data, loading, reload } = useApi('/dashboard');
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);

  const loadSampleData = async () => {
    setSeeding(true);
    try {
      const r = await api.post('/demo/seed');
      toast(`Sample data loaded — ${r.projects} orders, ${r.clients} clients, ${r.tasks} tasks & more`);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSeeding(false);
    }
  };

  const canApprove = ['owner', 'admin', 'manager', 'finance'].includes(user?.role);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const { stats, status_dist, budget_vs_spent, tasks_14d, upcoming, activity, workload } = data;

  const statCards = [
    { label: 'Active projects', value: stats.active_projects, icon: 'folder', tint: 'var(--primary-soft)', color: 'var(--primary)', to: '/projects', sub: `${stats.projects_completed} completed` },
    { label: 'Open tasks', value: stats.open_tasks, icon: 'kanban', tint: 'var(--violet-soft)', color: 'var(--violet)', to: '/tasks', sub: ['production','quality','sales'].includes(user.role) ? 'across your board' : 'across all projects' },
    { label: 'Pending timesheets', value: stats.pending_timesheets, icon: 'clock', tint: 'var(--warning-soft)', color: 'var(--warning)', to: '/timesheets', sub: canApprove ? 'awaiting approval' : 'of yours' },
    { label: 'Team members', value: stats.headcount, icon: 'users', tint: 'var(--success-soft)', color: 'var(--success)', to: '/employees', sub: `${stats.active_clients} active clients` },
  ];

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {['production','quality','sales'].includes(user.role) ? `Good to see you, ${user.name.split(' ')[0]} 👋` : 'Studio overview'}
          </h1>
          <p className="muted" style={{ marginTop: 3, fontSize: 13.5 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Hyderabad, IN
          </p>
        </div>
        <Link to="/tasks" className="btn btn--primary"><Icon name="plus" size={16} /> New task</Link>
      </div>

      {data && statsEmpty(data) && (
        <div className="card mb-16" style={{ border: '1px dashed var(--primary)', background: 'linear-gradient(135deg, #eef0fe, #f5f0ff)' }}>
          <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '18px 20px' }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name="sparkles" size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Your workspace is empty — want to explore?</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                Load sample data into <b>your account</b> — wedding orders across the pipeline, photo galleries, GST invoices, cost estimations, equipment inventory, timesheets & more. Everything is yours to edit or delete.
              </div>
            </div>
            <button className="btn btn--primary" onClick={loadSampleData} disabled={seeding}>
              <Icon name="sparkles" size={15} /> {seeding ? 'Loading…' : 'Load sample data'}
            </button>
          </div>
        </div>
      )}

      <div className="stat-grid mb-16">
        {statCards.map((s) => (
          <div key={s.label} className="stat-card" onClick={() => navigate(s.to)} style={{ cursor: 'pointer' }}>
            <div className="stat-card__icon" style={{ background: s.tint, color: s.color }}>
              <Icon name={s.icon} size={20} />
            </div>
            <div>
              <div className="stat-card__label">{s.label}</div>
              <div className="stat-card__value mono">{s.value}</div>
              <div className="stat-card__sub">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Budget vs spent</div>
              <div className="card__hint">Largest productions by budget</div>
            </div>
          </div>
          <div className="card__body">
            <BudgetBarChart data={budget_vs_spent} />
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Project pipeline</div>
              <div className="card__hint">All projects by status</div>
            </div>
          </div>
          <div className="card__body">
            <DonutChart
              data={status_dist.map((s) => ({ name: s.status, value: s.c }))}
              colors={status_dist.map((s) => STATUS_COLORS[s.status] || '#64748b')}
            />
          </div>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Tasks completed</div>
              <div className="card__hint">Last 14 days</div>
            </div>
          </div>
          <div className="card__body">
            <AreaChart data={tasks_14d} />
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Upcoming deadlines</div>
              <div className="card__hint">Next projects to wrap</div>
            </div>
            <Link to="/projects" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>View all</Link>
          </div>
          <div className="card__body" style={{ paddingTop: 10 }}>
            {upcoming.length === 0 && <p className="muted" style={{ padding: '16px 0' }}>Nothing due — enjoy the calm!</p>}
            {upcoming.map((p) => {
              const d = daysUntil(p.deadline);
              return (
                <div key={p.id} className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => navigate(`/projects/${p.id}`)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{p.client_name || '—'}</div>
                  </div>
                  <div className="flex gap-8" style={{ flexShrink: 0 }}>
                    <span className={`due-chip ${d < 0 ? 'overdue' : d <= 3 ? 'today' : ''}`}>
                      <Icon name="calendar" size={13} /> {d < 0 ? `${-d}d overdue` : d === 0 ? 'Today' : `${d}d left`}
                    </span>
                    <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>{p.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Recent activity</div>
              <div className="card__hint">Latest actions across the studio</div>
            </div>
            {canApprove && <Link to="/activity" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>Full log</Link>}
          </div>
          <div className="card__body" style={{ paddingTop: 14 }}>
            <div className="timeline">
              {activity.map((a) => (
                <div key={a.id} className="timeline-item">
                  <div className="timeline-item__head">
                    <span style={{ fontWeight: 700 }}>{a.user_name || 'System'}</span>{' '}
                    <span className="text-2" style={{ fontWeight: 500 }}>{a.action}</span>
                  </div>
                  <div className="timeline-item__sub">{a.details} · {relativeTime(a.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Team workload</div>
              <div className="card__hint">Open tasks by team member</div>
            </div>
          </div>
          <div className="card__body" style={{ paddingTop: 12 }}>
            {workload.map((w, i) => (
              <div key={w.id} className="flex" style={{ gap: 11, padding: '9px 0', borderBottom: i < workload.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <Avatar name={w.name} hue={w.avatar_hue} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{w.name}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{w.department}</div>
                </div>
                <span className="mono" style={{ fontWeight: 800, fontSize: 15 }}>{w.open}</span>
                <span className="muted" style={{ fontSize: 11.5 }}>open</span>
              </div>
            ))}
            {workload.length === 0 && <p className="muted" style={{ padding: '16px 0' }}>No open tasks — everyone's caught up.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function statsEmpty(d) {
  const st = d?.stats || {};
  return (st.active_projects || 0) === 0 && (st.active_clients || 0) === 0;
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="stat-grid mb-16">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card" style={{ padding: 16 }}><Skeleton style={{ height: 64 }} /></div>)}
      </div>
      <div className="grid-2 mb-16">
        <div className="card" style={{ padding: 16 }}><Skeleton style={{ height: 260 }} /></div>
        <div className="card" style={{ padding: 16 }}><Skeleton style={{ height: 260 }} /></div>
      </div>
      <div className="grid-2">
        <div className="card" style={{ padding: 16 }}><Skeleton style={{ height: 240 }} /></div>
        <div className="card" style={{ padding: 16 }}><Skeleton style={{ height: 240 }} /></div>
      </div>
    </div>
  );
}
