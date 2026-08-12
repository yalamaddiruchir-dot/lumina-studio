import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Avatar, Badge, EmptyState, Modal, ConfirmDialog, PageHeader, SearchBox, Skeleton } from '../components/ui';
import { formatDateShort, daysUntil } from '../lib/format';

const COLUMNS = [
  { key: 'todo', label: 'To do', tint: '#64748b' },
  { key: 'in_progress', label: 'In progress', tint: '#2563eb' },
  { key: 'review', label: 'In review', tint: '#d97706' },
  { key: 'done', label: 'Done', tint: '#0ea371' },
];

export default function Tasks() {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data, loading, setData } = useApi('/tasks');
  const { data: projects } = useApi(can('projects.view') ? '/projects' : null);
  const { data: employees } = useApi('/employees');

  const [q, setQ] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [showMine, setShowMine] = useState(false);
  const [modal, setModal] = useState(null); // create or edit
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => (data || []).filter((t) => {
    if (showMine && t.assignee_id !== user?.id) return false;
    if (projectFilter !== 'all' && t.project_id !== Number(projectFilter)) return false;
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [data, q, projectFilter, showMine, user]);

  const columns = useMemo(() => COLUMNS.map((c) => ({ ...c, tasks: filtered.filter((t) => t.status === c.key) })), [filtered]);

  const canMove = (t) => can('tasks.manage') || (can('tasks.own') && t.assignee_id === user?.id);

  const move = async (task, status) => {
    const prev = task.status;
    setData((d) => d.map((t) => (t.id === task.id ? { ...t, status } : t))); // optimistic
    try {
      await api.patch(`/tasks/${task.id}/status`, { status });
      toast(`Moved to ${status.replace('_', ' ')}`);
    } catch (e) {
      setData((d) => d.map((t) => (t.id === task.id ? { ...t, status: prev } : t)));
      toast(e.message, 'error');
    }
  };

  const save = async (form) => {
    setBusy(true);
    try {
      if (modal.mode === 'create') {
        const created = await api.post('/tasks', form);
        setData((d) => [created, ...(d || [])]);
        toast('Task created');
      } else {
        const updated = await api.put(`/tasks/${modal.task.id}`, form);
        setData((d) => d.map((t) => (t.id === updated.id ? updated : t)));
        toast('Task updated');
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
      await api.del(`/tasks/${deleting.id}`);
      setData((d) => d.filter((t) => t.id !== deleting.id));
      toast('Task removed');
      setDeleting(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Task board" sub={`${filtered.length} task${filtered.length === 1 ? '' : 's'} shown`}
        actions={can('tasks.manage') && <button className="btn btn--primary" onClick={() => setModal({ mode: 'create', task: null })}><Icon name="plus" size={16} /> New task</button>} />

      <div className="toolbar mb-16">
        <SearchBox value={q} onChange={setQ} placeholder="Search tasks…" style={{ width: 250 }} />
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ font: 'inherit', fontSize: 13, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', outline: 'none' }}>
          <option value="all">All projects</option>
          {(projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {['production','quality','sales'].includes(user?.role) && (
          <button className={`btn btn--sm ${showMine ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setShowMine((v) => !v)}>
            <Icon name="user" size={14} /> My tasks only
          </button>
        )}
      </div>

      {loading ? (
        <div className="board">{[...Array(4)].map((_, i) => <div key={i} className="board-col"><Skeleton style={{ height: 200, margin: 12 }} /></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="kanban"
            title={showMine ? 'No tasks assigned to you' : q || projectFilter !== 'all' ? 'No matching tasks' : 'The board is empty'}
            message={showMine ? 'Nice — nothing assigned to you right now.' : 'Create a task to get the board moving.'}
            action={can('tasks.manage') && <button className="btn btn--primary" onClick={() => setModal({ mode: 'create', task: null })}><Icon name="plus" size={15} /> New task</button>}
          />
        </div>
      ) : (
        <div className="board">
          {columns.map((col) => (
            <div key={col.key} className="board-col">
              <div className="board-col__head">
                <span style={{ width: 8, height: 8, borderRadius: 3, background: col.tint, display: 'inline-block' }} />
                {col.label}
                <span className="board-col__count">{col.tasks.length}</span>
              </div>
              <div className="board-col__body">
                {col.tasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onClick={() => can('tasks.manage') ? setModal({ mode: 'edit', task: t }) : navigate(`/projects/${t.project_id}`)}
                    canMove={canMove(t)}
                    onMove={(s) => move(t, s)}
                    onDelete={() => can('tasks.manage') && setDeleting(t)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <TaskModal mode={modal.mode} task={modal.task} projects={projects || []} employees={employees || []} busy={busy} onClose={() => setModal(null)} onSave={save} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="Delete task?" message={`"${deleting?.title}" will be permanently removed.`} />
    </div>
  );
}

function TaskCard({ task, onClick, canMove, onMove, onDelete }) {
  const d = daysUntil(task.due_date);
  return (
    <div className="board-card" onClick={onClick}>
      <div className="board-card__title">{task.title}</div>
      {task.project_name && (
        <div className="board-card__proj">
          <span style={{ textTransform: 'capitalize', fontWeight: 700, color: 'var(--text-2)' }}>{task.project_type}</span> · {task.project_name}
        </div>
      )}
      {task.project_status && (
        <div style={{ marginTop: 7 }}>
          <Badge status={task.project_status} className="badge--dotless" />
        </div>
      )}
      <div className="board-card__foot">
        <div className="flex gap-6">
          {task.assignee_name ? <Avatar name={task.assignee_name} hue={task.assignee_hue} size="sm" /> : <span className="muted" style={{ fontSize: 11.5 }}>Unassigned</span>}
          <span className={`due-chip ${d < 0 ? 'overdue' : d === 0 ? 'today' : ''}`}>
            <Icon name="calendar" size={12} />
            {task.due_date ? (d < 0 ? `${-d}d overdue` : d === 0 ? 'Today' : formatDateShort(task.due_date)) : '—'}
          </span>
        </div>
        {canMove && (
          <div className="flex gap-6" onClick={(e) => e.stopPropagation()}>
            <select
              value={task.status}
              onChange={(e) => onMove(e.target.value)}
              style={{ font: 'inherit', fontSize: 11.5, padding: '3px 6px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', outline: 'none', color: 'var(--text-2)', fontWeight: 600 }}
              title="Move task"
            >
              {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            {onDelete && (
              <button className="icon-btn" style={{ width: 26, height: 26, border: 'none', background: 'transparent', color: 'var(--text-3)' }} onClick={onDelete} title="Delete">
                <Icon name="trash" size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskModal({ mode, task, projects, employees, busy, onClose, onSave }) {
  const [f, setF] = useState(mode === 'edit' ? { ...task } : { title: '', description: '', project_id: '', assignee_id: '', status: 'todo', priority: 'medium', due_date: '', estimated_hours: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} size="lg" title={mode === 'create' ? 'New task' : 'Edit task'}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.title.trim()} onClick={() => onSave(f)}>{busy ? 'Saving…' : mode === 'create' ? 'Create task' : 'Save changes'}</button>
        </>
      }>
      <div className="form-grid">
        <div className="field span-2"><label>Title <span className="req">*</span></label><input value={f.title} onChange={set('title')} placeholder="What needs to be done?" /></div>
        <div className="field"><label>Project</label>
          <select value={f.project_id || ''} onChange={set('project_id')}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Assignee</label>
          <select value={f.assignee_id || ''} onChange={set('assignee_id')}>
            <option value="">Unassigned</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Status</label>
          <select value={f.status} onChange={set('status')}>
            {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="field"><label>Priority</label>
          <select value={f.priority} onChange={set('priority')}>
            {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field"><label>Due date</label><input type="date" value={f.due_date} onChange={set('due_date')} /></div>
        <div className="field"><label>Estimated hours</label><input type="number" value={f.estimated_hours} onChange={set('estimated_hours')} placeholder="0" /></div>
        <div className="field span-2"><label>Description</label><textarea value={f.description} onChange={set('description')} /></div>
      </div>
    </Modal>
  );
}
