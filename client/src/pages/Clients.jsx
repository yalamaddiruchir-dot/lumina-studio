import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Badge, EmptyState, Modal, ConfirmDialog, PageHeader, SearchBox, Skeleton, usePager, Pager, RowActions } from '../components/ui';
import { moneyCompact, formatDate, initials } from '../lib/format';

const empty = { name: '', company: '', email: '', phone: '', industry: '', status: 'active', notes: '' };

export default function Clients() {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data, loading, setData } = useApi('/clients');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => (data || []).filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (q && !`${c.name} ${c.company} ${c.industry}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [data, q, statusFilter]);

  const pager = usePager(filtered, 8);

  const save = async (form) => {
    setBusy(true);
    try {
      if (modal.mode === 'create') {
        const created = await api.post('/clients', form);
        setData((d) => [created, ...(d || [])]);
        toast('Client added');
      } else {
        const updated = await api.put(`/clients/${modal.client.id}`, form);
        setData((d) => d.map((c) => (c.id === updated.id ? updated : c)));
        toast('Client updated');
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
      await api.del(`/clients/${deleting.id}`);
      setData((d) => d.filter((c) => c.id !== deleting.id));
      toast('Client removed');
      setDeleting(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Clients" sub={`${filtered.length} account${filtered.length === 1 ? '' : 's'}`}
        actions={can('clients.manage') && <button className="btn btn--primary" onClick={() => setModal({ mode: 'create', client: empty })}><Icon name="plus" size={16} /> Add client</button>} />

      <div className="toolbar mb-16">
        <SearchBox value={q} onChange={setQ} placeholder="Search clients…" style={{ width: 250 }} />
        <div className="segmented">
          {['all', 'active', 'inactive'].map((s) => (
            <button key={s} className={statusFilter === s ? 'active' : ''} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <TableSkeleton cols={5} /> : filtered.length === 0 ? (
            <EmptyState icon="building" title={q ? 'No matching clients' : 'No clients yet'}
              message={q ? 'Try a different search.' : 'Add your first client account.'}
              action={can('clients.manage') && <button className="btn btn--primary" onClick={() => setModal({ mode: 'create', client: empty })}><Icon name="plus" size={15} /> Add client</button>} />
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Client</th><th>Industry</th><th>Projects</th><th>Total budget</th><th>Status</th><th>Added</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cell-user">
                        <span style={{ width: 34, height: 34, borderRadius: 10, background: `hsl(${c.hue} 65% 92%)`, color: `hsl(${c.hue} 55% 38%)`, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                          {initials(c.name)}
                        </span>
                        <div>
                          <div className="td-main">{c.name}</div>
                          <div className="td-sub">{c.company || c.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="muted" style={{ fontWeight: 500 }}>{c.industry || '—'}</span></td>
                    <td><b className="mono">{c.project_count}</b><span className="muted" style={{ fontSize: 12 }}> ({c.active_projects} active)</span></td>
                    <td className="mono" style={{ fontWeight: 600 }}>{moneyCompact(c.total_budget)}</td>
                    <td><Badge status={c.status} /></td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{formatDate(c.created_at)}</td>
                    <td>
                      <RowActions
                        canEdit={can('clients.manage')} canDelete={can('clients.manage')}
                        onEdit={() => setModal({ mode: 'edit', client: c })}
                        onDelete={() => setDeleting(c)}
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
        <ClientModal mode={modal.mode} client={modal.client} busy={busy} onClose={() => setModal(null)} onSave={save} />
      )}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy}
        title="Remove client?" message={`"${deleting?.name}" will be removed. Their projects will keep working but lose the client link.`} />
    </div>
  );
}

function ClientModal({ mode, client, busy, onClose, onSave }) {
  const [f, setF] = useState(client);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} size="lg" title={mode === 'create' ? 'Add client' : 'Edit client'}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.name.trim()} onClick={() => onSave(f)}>
            {busy ? 'Saving…' : mode === 'create' ? 'Add client' : 'Save changes'}
          </button>
        </>
      }>
      <div className="form-grid">
        <div className="field"><label>Client name <span className="req">*</span></label><input value={f.name} onChange={set('name')} placeholder="e.g. Zenith Motors" /></div>
        <div className="field"><label>Company</label><input value={f.company} onChange={set('company')} placeholder="Legal entity name" /></div>
        <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set('email')} placeholder="contact@company.com" /></div>
        <div className="field"><label>Phone</label><input value={f.phone} onChange={set('phone')} placeholder="+91 …" /></div>
        <div className="field"><label>Industry</label><input value={f.industry} onChange={set('industry')} placeholder="e.g. Automotive" /></div>
        <div className="field"><label>Status</label>
          <select value={f.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="field span-2"><label>Notes</label><textarea value={f.notes} onChange={set('notes')} /></div>
      </div>
    </Modal>
  );
}

function TableSkeleton({ cols }) {
  return (
    <div style={{ padding: 16 }}>
      {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 10 }} />)}
    </div>
  );
}
