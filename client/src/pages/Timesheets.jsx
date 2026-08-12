import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Avatar, Badge, EmptyState, Modal, PageHeader, Skeleton } from '../components/ui';
import { formatDate } from '../lib/format';

export default function Timesheets() {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const { data, loading, setData } = useApi('/timesheets');
  const { data: projects } = useApi('/projects');
  const { data: employees } = useApi('/employees');
  const [filter, setFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const isApprover = can('timesheets.approve');
  const seesAll = can('timesheets.view_all');

  const filtered = useMemo(() => (data || []).filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (seesAll && userFilter !== 'all' && t.user_id !== Number(userFilter)) return false;
    return true;
  }), [data, filter, userFilter, seesAll]);

  const totalHours = filtered.reduce((s, t) => s + (t.hours || 0), 0);
  const myTotal = (data || []).filter((t) => t.user_id === user?.id).reduce((s, t) => s + (t.hours || 0), 0);

  const changeStatus = async (ts, status) => {
    const prev = ts.status;
    setData((d) => d.map((t) => (t.id === ts.id ? { ...t, status } : t))); // optimistic
    try {
      await api.patch(`/timesheets/${ts.id}/status`, { status });
      toast(`Timesheet ${status}`);
    } catch (e) {
      setData((d) => d.map((t) => (t.id === ts.id ? { ...t, status: prev } : t)));
      toast(e.message, 'error');
    }
  };

  const submit = async (form) => {
    setBusy(true);
    try {
      const created = await api.post('/timesheets', form);
      setData((d) => [created, ...(d || [])]);
      toast('Timesheet submitted for approval');
      setModal(false);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const myPending = (data || []).filter((t) => t.user_id === user?.id && t.status === 'pending').length;

  return (
    <div>
      <PageHeader title="Timesheets" sub={isApprover ? 'Review and approve team hours' : 'Log your hours'}
        actions={<button className="btn btn--primary" onClick={() => setModal(true)}><Icon name="plus" size={16} /> Log hours</button>} />

      <div className="stat-grid mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Icon name="clock" size={20} /></div>
          <div>
            <div className="stat-card__label">{isApprover ? 'Hours this view' : 'Your total hours'}</div>
            <div className="stat-card__value mono">{totalHours.toFixed(1)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="hourglass" size={20} /></div>
          <div>
            <div className="stat-card__label">{isApprover ? 'Awaiting approval' : 'Your pending'}</div>
            <div className="stat-card__value mono">{isApprover ? (data || []).filter((t) => t.status === 'pending').length : myPending}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}><Icon name="checkCircle" size={20} /></div>
          <div>
            <div className="stat-card__label">Approved</div>
            <div className="stat-card__value mono">{(filtered || []).filter((t) => t.status === 'approved').length}</div>
          </div>
        </div>
        {!isApprover && (
          <div className="stat-card">
            <div className="stat-card__icon" style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}><Icon name="users" size={20} /></div>
            <div>
              <div className="stat-card__label">Entries logged</div>
              <div className="stat-card__value mono">{myTotal.toFixed(1)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="toolbar mb-16">
        <div className="segmented">
          {['all', 'pending', 'approved', 'rejected'].map((s) => (
            <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
        {seesAll && (
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
            style={{ font: 'inherit', fontSize: 13, padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', outline: 'none' }}>
            <option value="all">All members</option>
            {(employees || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 16 }}>{[...Array(7)].map((_, i) => <div key={i} className="skeleton" style={{ height: 46, marginBottom: 8 }} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="clock" title="No timesheets here"
            message={filter !== 'all' ? `No ${filter} entries.` : 'Log your first entry to track hours.'}
            action={<button className="btn btn--primary" onClick={() => setModal(true)}><Icon name="plus" size={15} /> Log hours</button>} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  {seesAll && <th>Member</th>}
                  <th>Project</th>
                  <th style={{ textAlign: 'right' }}>Hours</th>
                  <th>Description</th>
                  <th>Status</th>
                  {isApprover && <th style={{ textAlign: 'right' }}>Approve</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td><b>{formatDate(t.date)}</b></td>
                    {seesAll && (
                      <td>
                        <div className="cell-user">
                          <Avatar name={t.user_name} hue={t.user_hue} size="sm" />
                          <span style={{ fontWeight: 600 }}>{t.user_name}</span>
                        </div>
                      </td>
                    )}
                    <td><span className="muted" style={{ fontWeight: 500 }}>{t.project_name || '—'}</span></td>
                    <td style={{ textAlign: 'right' }}><b className="mono">{t.hours}h</b></td>
                    <td className="muted" style={{ fontSize: 12.5, maxWidth: 260 }}>{t.description || '—'}</td>
                    <td><Badge status={t.status} /></td>
                    {isApprover && t.status === 'pending' && (
                      <td>
                        <div className="flex gap-6" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn--sm btn--secondary" onClick={() => changeStatus(t, 'rejected')} title="Reject"><Icon name="x" size={13} /></button>
                          <button className="btn btn--sm btn--primary" onClick={() => changeStatus(t, 'approved')} title="Approve"><Icon name="check" size={13} /></button>
                        </div>
                      </td>
                    )}
                    {isApprover && t.status !== 'pending' && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <TimesheetModal projects={projects || []} busy={busy} onClose={() => setModal(false)} onSave={submit} />
      )}
    </div>
  );
}

function TimesheetModal({ projects, busy, onClose, onSave }) {
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), hours: '8', project_id: '', description: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title="Log hours"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.date || !f.hours} onClick={() => onSave(f)}>{busy ? 'Saving…' : 'Submit timesheet'}</button>
        </>
      }>
      <div className="form-grid">
        <div className="field"><label>Date <span className="req">*</span></label><input type="date" value={f.date} onChange={set('date')} /></div>
        <div className="field"><label>Hours <span className="req">*</span></label><input type="number" min="0.5" max="24" step="0.5" value={f.hours} onChange={set('hours')} /></div>
        <div className="field span-2"><label>Project</label>
          <select value={f.project_id} onChange={set('project_id')}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field span-2"><label>Description</label><textarea value={f.description} onChange={set('description')} placeholder="What did you work on?" /></div>
      </div>
    </Modal>
  );
}
