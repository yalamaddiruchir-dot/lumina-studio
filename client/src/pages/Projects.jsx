import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Avatar, Badge, EmptyState, Modal, ConfirmDialog, PageHeader, SearchBox, Skeleton, usePager, Pager, RowActions } from '../components/ui';
import { moneyCompact, formatDateShort, daysUntil } from '../lib/format';

const TYPES = ['wedding', 'pre_wedding', 'event', 'corporate', 'portfolio'];
const STATUSES = ['booked', 'data_copy', 'lightroom', 'video', 'album', 'final_review', 'delivered'];
const TYPE_ICONS = { wedding: 'heart', pre_wedding: 'camera', event: 'calendar', corporate: 'briefcase', portfolio: 'image' };

const empty = { name: '', client_id: '', type: 'wedding', status: 'booked', priority: 'medium', budget: '', spent: '', start_date: '', shoot_date: '', deadline: '', manager_id: '', description: '' };

/** Progress % derived from pipeline position (server sends its own too). */
const stageProgress = (status) => {
  const i = STATUSES.indexOf(status);
  return i < 0 ? 0 : Math.round((i / (STATUSES.length - 1)) * 100);
};

export default function Projects() {
  const { can } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data, loading, setData, reload } = useApi('/projects');
  const { data: clients } = useApi(can('clients.view') ? '/clients' : null);
  const { data: employees } = useApi('/employees');

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState(null); // { mode: 'create' | 'edit', project }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const managers = useMemo(() => (employees || []).filter((e) => ['owner', 'admin', 'manager'].includes(e.role)), [employees]);

  const filtered = useMemo(() => (data || []).filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [data, q, statusFilter, typeFilter]);

  const pager = usePager(filtered, 9);

  const save = async (form) => {
    setBusy(true);
    try {
      if (modal.mode === 'create') {
        const created = await api.post('/projects', form);
        setData((d) => [created, ...(d || [])]);
        toast('Project created');
      } else {
        const updated = await api.put(`/projects/${modal.project.id}`, form);
        setData((d) => d.map((p) => (p.id === updated.id ? updated : p)));
        toast('Project updated');
      }
      setModal(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/projects/${deleting.id}`);
      setData((d) => d.filter((p) => p.id !== deleting.id));
      toast('Project removed');
      setDeleting(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Projects" sub={`${filtered.length} production${filtered.length === 1 ? '' : 's'}`}
        actions={can('projects.manage') && <button className="btn btn--primary" onClick={() => setModal({ mode: 'create', project: empty })}><Icon name="plus" size={16} /> New project</button>} />

      <div className="toolbar mb-16">
        <SearchBox value={q} onChange={setQ} placeholder="Search projects…" style={{ width: 260 }} />
        <div className="segmented">
          {['all', ...STATUSES].map((s) => (
            <button key={s} className={statusFilter === s ? 'active' : ''} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ font: 'inherit', fontSize: 13, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', outline: 'none' }}>
          <option value="all">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="project-grid">{[...Array(6)].map((_, i) => <div key={i} className="card" style={{ height: 170 }}><Skeleton style={{ height: '100%' }} /></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="folder"
            title={q || statusFilter !== 'all' ? 'No matching projects' : 'No projects yet'}
            message={q || statusFilter !== 'all' ? 'Try a different search or filter.' : 'Create your first production to get the pipeline moving.'}
            action={can('projects.manage') && <button className="btn btn--primary" onClick={() => setModal({ mode: 'create', project: empty })}><Icon name="plus" size={15} /> New project</button>}
          />
        </div>
      ) : (
        <>
          <div className="project-grid mb-12">
            {pager.slice.map((p) => {
              const d = daysUntil(p.deadline);
              const finished = ['delivered', 'completed', 'cancelled'].includes(p.status);
              const pct = Math.min(p.progress ?? stageProgress(p.status), 100);
              return (
                <div key={p.id} className="project-card" onClick={() => navigate(`/projects/${p.id}`)}>
                  <div className="project-card__top">
                    <div style={{ minWidth: 0 }}>
                      <div className="project-card__name">{p.name}</div>
                      <div className="project-card__client">
                        <span style={{ width: 8, height: 8, borderRadius: 3, background: `hsl(${p.client_hue || 160} 70% 55%)`, display: 'inline-block' }} />
                        {p.client_name || 'Internal'}
                        <span style={{ color: 'var(--text-3)' }}>·</span>
                        <span style={{ textTransform: 'capitalize' }}>{p.type}</span>
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <Badge status={p.status} />
                    </div>
                  </div>
                  <div>
                    <div className="flex-between mb-8" style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>
                      <span>Progress</span><span className="mono">{pct}%</span>
                    </div>
                    <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="project-card__foot">
                    <div className="project-card__meta">
                      <Icon name="wallet" size={13} />
                      <span className="mono">{moneyCompact(p.spent)} <span className="muted">/ {moneyCompact(p.budget)}</span></span>
                    </div>
                    <div className="project-card__meta">
                      {p.photo_count > 0 && (
                        <span className="flex gap-6" title={`${p.photo_count} photos · ${p.selected_photos || 0} client selected`}>
                          <Icon name="image" size={13} /> {p.photo_count}
                        </span>
                      )}
                      <Icon name="calendar" size={13} />
                      {finished ? (
                        <span style={{ color: p.status === 'delivered' ? 'var(--success)' : 'var(--text-3)', fontWeight: 700 }}>
                          {p.status === 'delivered' ? '✓ Delivered' : 'Cancelled'}
                        </span>
                      ) : (
                        <span className={d < 0 ? 'due-chip overdue' : d <= 3 ? 'due-chip today' : ''}>
                          {d < 0 ? `${-d}d overdue` : d === 0 ? 'Due today' : d === null ? 'No date' : `${d}d left`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pager {...pager} />
        </>
      )}

      {modal && (
        <ProjectModal
          mode={modal.mode} project={modal.project} clients={clients || []} managers={managers}
          busy={busy} onClose={() => setModal(null)} onSave={save}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        title="Delete project?"
        message={`"${deleting?.name}" and all of its tasks will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete project"
      />
    </div>
  );
}

function ProjectModal({ mode, project, clients, managers, busy, onClose, onSave }) {
  const [f, setF] = useState(project);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} size="lg" title={mode === 'create' ? 'New project' : 'Edit project'}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.name.trim()} onClick={() => onSave(f)}>
            {busy ? 'Saving…' : mode === 'create' ? 'Create project' : 'Save changes'}
          </button>
        </>
      }>
      <div className="form-grid">
        <div className="field span-2">
          <label>Project name <span className="req">*</span></label>
          <input value={f.name} onChange={set('name')} placeholder="e.g. Zenith Motors — Launch Film" />
        </div>
        <div className="field">
          <label>Client</label>
          <select value={f.client_id || ''} onChange={set('client_id')}>
            <option value="">Internal / no client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Project manager</label>
          <select value={f.manager_id || ''} onChange={set('manager_id')}>
            <option value="">Unassigned</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Type</label>
          <select value={f.type} onChange={set('type')}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={f.status} onChange={set('status')}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Priority</label>
          <select value={f.priority} onChange={set('priority')}>
            {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Progress (%)</label>
          <input type="number" min="0" max="100" value={f.progress} onChange={set('progress')} />
        </div>
        <div className="field">
          <label>Budget (₹)</label>
          <input type="number" value={f.budget} onChange={set('budget')} placeholder="0" />
        </div>
        <div className="field">
          <label>Spent (₹)</label>
          <input type="number" value={f.spent} onChange={set('spent')} placeholder="0" />
        </div>
        <div className="field">
          <label>Start date</label>
          <input type="date" value={f.start_date} onChange={set('start_date')} />
        </div>
        <div className="field">
          <label>Shoot date</label>
          <input type="date" value={f.shoot_date} onChange={set('shoot_date')} />
        </div>
        <div className="field">
          <label>Deadline</label>
          <input type="date" value={f.deadline} onChange={set('deadline')} />
        </div>
        <div className="field span-2">
          <label>Description</label>
          <textarea value={f.description} onChange={set('description')} placeholder="What is this production about?" />
        </div>
      </div>
    </Modal>
  );
}
