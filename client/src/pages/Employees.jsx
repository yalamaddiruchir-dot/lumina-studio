import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Avatar, Badge, EmptyState, Modal, ConfirmDialog, PageHeader, SearchBox, Skeleton, usePager, Pager, RowActions, ROLE_META } from '../components/ui';
import { money, formatDate } from '../lib/format';

const ROLES = ['owner', 'admin', 'manager', 'hr', 'finance', 'sales', 'quality', 'production'];
const DEPARTMENTS = ['Management', 'Camera Department', 'Production Team', 'Sales & Client Management', 'Finance', 'Administration'];

const empty = { name: '', email: '', role: 'production', department: '', position: '', phone: '', location: 'Hyderabad', salary: '', hire_date: '', status: 'active', bio: '', skills: '' };

export default function Employees() {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data, loading, setData } = useApi('/employees');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const canSalary = can('salary.view');

  const filtered = useMemo(() => (data || []).filter((e) => {
    if (roleFilter !== 'all' && e.role !== roleFilter) return false;
    if (q && !`${e.name} ${e.email} ${e.position} ${e.department}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [data, q, roleFilter]);

  const pager = usePager(filtered, 9);

  const save = async (form) => {
    setBusy(true);
    try {
      if (modal.mode === 'create') {
        const created = await api.post('/employees', form);
        setData((d) => [...(d || []), created]);
        toast(`${created.name} added to the team`);
      } else {
        const updated = await api.put(`/employees/${modal.employee.id}`, form);
        setData((d) => d.map((e) => (e.id === updated.id ? updated : e)));
        toast('Employee updated');
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
      await api.del(`/employees/${deleting.id}`);
      setData((d) => d.filter((e) => e.id !== deleting.id));
      toast('Employee removed');
      setDeleting(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Team" sub={`${filtered.length} member${filtered.length === 1 ? '' : 's'}`}
        actions={can('employees.manage') && <button className="btn btn--primary" onClick={() => setModal({ mode: 'create', employee: empty })}><Icon name="plus" size={16} /> Add employee</button>} />

      <div className="toolbar mb-16">
        <SearchBox value={q} onChange={setQ} placeholder="Search by name, role, dept…" style={{ width: 280 }} />
        <div className="segmented">
          <button className={roleFilter === 'all' ? 'active' : ''} onClick={() => setRoleFilter('all')}>All</button>
          {ROLES.map((r) => (
            <button key={r} className={roleFilter === r ? 'active' : ''} onClick={() => setRoleFilter(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 16 }}>{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 10 }} />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="users" title={q || roleFilter !== 'all' ? 'No matching employees' : 'No employees yet'}
              message={q || roleFilter !== 'all' ? 'Try a different search or filter.' : 'Invite your first team member.'}
              action={can('employees.manage') && <button className="btn btn--primary" onClick={() => setModal({ mode: 'create', employee: empty })}><Icon name="plus" size={15} /> Add employee</button>} />
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th><th>Role</th><th>Department</th><th>Access</th>
                  {canSalary && <th style={{ textAlign: 'right' }}>Monthly salary</th>}
                  <th>Status</th><th>Joined</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={e.name} hue={e.avatar_hue} />
                        <div>
                          <div className="td-main">{e.name}</div>
                          <div className="td-sub">{e.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge role={e.role} /></td>
                    <td>
                      <div className="td-main" style={{ fontWeight: 600 }}>{e.department || '—'}</div>
                      <div className="td-sub">{e.position || ''}</div>
                    </td>
                    <td>
                      <span className="level-pill" title={`Access level ${ROLE_META[e.role]?.level || 1}`}>{ROLE_META[e.role]?.level || 1}</span>
                    </td>
                    {canSalary && (
                      <td style={{ textAlign: 'right' }}><b className="mono">{e.salary ? money(e.salary) : '—'}</b></td>
                    )}
                    <td><Badge status={e.status} /></td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{formatDate(e.hire_date)}</td>
                    <td>
                      <RowActions
                        canEdit={can('employees.manage')} canDelete={can('employees.delete')}
                        onEdit={() => setModal({ mode: 'edit', employee: e })}
                        onDelete={() => setDeleting(e)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && filtered.length > 0 && <div style={{ padding: '0 14px 10px' }}><Pager {...pager} /></div>}
      </div>

      {modal && (
        <EmployeeModal mode={modal.mode} employee={modal.employee} busy={busy} canSalary={canSalary}
          onClose={() => setModal(null)} onSave={save} />
      )}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy}
        title="Remove employee?" message={`${deleting?.name}'s account will be deactivated and removed from the team.`} />
    </div>
  );
}

function EmployeeModal({ mode, employee, busy, canSalary, onClose, onSave }) {
  const [f, setF] = useState(employee);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const level = ROLE_META[f.role]?.level || 1;
  return (
    <Modal open onClose={onClose} size="lg" title={mode === 'create' ? 'Add employee' : 'Edit employee'}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.name.trim() || !f.email.trim()} onClick={() => onSave(f)}>
            {busy ? 'Saving…' : mode === 'create' ? 'Add employee' : 'Save changes'}
          </button>
        </>
      }>
      <div className="permission-note">
        <Icon name="shield" size={16} />
        <span>Access level <b>{level}</b> — this role can {describeRole(f.role)}. Adjust the role to change what this person can see and do.</span>
      </div>
      <div className="form-grid">
        <div className="field"><label>Full name <span className="req">*</span></label><input value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Work email <span className="req">*</span></label><input type="email" value={f.email} onChange={set('email')} /></div>
        <div className="field"><label>Role</label>
          <select value={f.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r} value={r}>{r} · level {ROLE_META[r]?.level}</option>)}
          </select>
        </div>
        <div className="field"><label>Department</label>
          <select value={f.department || ''} onChange={set('department')}>
            <option value="">Select…</option>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="field"><label>Position</label><input value={f.position} onChange={set('position')} placeholder="e.g. Video Editor" /></div>
        <div className="field"><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div>
        <div className="field"><label>Location</label><input value={f.location} onChange={set('location')} /></div>
        <div className="field"><label>Status</label>
          <select value={f.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="on-leave">On leave</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        {mode === 'create' && (
          <div className="field span-2">
            <label>Login password</label>
            <input type="text" value={f.password || ''} onChange={set('password')} placeholder="Temporary login password (default: demo123)" />
            <span className="hint">Share this with the employee — they can change it from their profile.</span>
          </div>
        )}
        {canSalary && (
          <>
            <div className="field"><label>Monthly salary (₹)</label><input type="number" value={f.salary} onChange={set('salary')} /></div>
            <div className="field"><label>Hire date</label><input type="date" value={f.hire_date} onChange={set('hire_date')} /></div>
          </>
        )}
        <div className="field span-2"><label>Skills</label><input value={f.skills} onChange={set('skills')} placeholder="Premiere Pro, Figma, …" /></div>
        <div className="field span-2"><label>Bio</label><textarea value={f.bio} onChange={set('bio')} /></div>
      </div>
    </Modal>
  );
}

function describeRole(role) {
  const map = {
    owner: 'manage everything and give final sign-off on deliveries',
    admin: 'run systems and accounts end-to-end and view payroll',
    manager: 'plan production, assign stages, advance the workflow and approve timesheets',
    hr: 'manage people, attendance and salaries',
    finance: 'manage billing, payroll and approve timesheets',
    sales: 'book new clients, create orders and coordinate with them',
    quality: 'perform final review and release projects to delivery',
    production: 'work on their assigned stage (data copy / lightroom / video / album)',
  };
  return map[role] || 'work on their assigned stage';
}
