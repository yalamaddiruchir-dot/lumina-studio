import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { EmptyState, Modal, PageHeader, SearchBox, Skeleton, RowActions } from '../components/ui';
import { money } from '../lib/format';

const CATS = {
  camera: { label: 'Camera', icon: 'camera', color: 'var(--info)' },
  hard_disk: { label: 'Hard Disk / Storage', icon: 'cube', color: 'var(--violet)' },
  stand: { label: 'Stand / Support', icon: 'target', color: 'var(--warning)' },
  equipment: { label: 'Equipment', icon: 'zap', color: 'var(--success)' },
};

const empty = { name: '', category: 'camera', brand: '', quantity: '1', rent_per_event: '', notes: '' };

export default function Inventory() {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data, loading, setData } = useApi('/inventory');
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const canManage = can('inventory.manage');

  const filtered = useMemo(() => (data || []).filter((i) => {
    if (catFilter !== 'all' && i.category !== catFilter) return false;
    if (q && !`${i.name} ${i.brand}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [data, q, catFilter]);

  const save = async (form) => {
    setBusy(true);
    try {
      if (modal.mode === 'create') {
        const created = await api.post('/inventory', form);
        setData((d) => [created, ...(d || [])]);
        toast('Inventory item added');
      } else {
        const updated = await api.put(`/inventory/${modal.item.id}`, form);
        setData((d) => d.map((x) => (x.id === updated.id ? updated : x)));
        toast('Inventory item updated');
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
      await api.del(`/inventory/${deleting.id}`);
      setData((d) => d.filter((x) => x.id !== deleting.id));
      toast('Inventory item removed');
      setDeleting(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Equipment inventory" sub="Cameras, hard disks, stands & rent per event"
        actions={canManage && <button className="btn btn--primary" onClick={() => setModal({ mode: 'create', item: empty })}><Icon name="plus" size={16} /> Add item</button>} />

      {!canManage && (
        <div className="permission-note">
          <Icon name="lock" size={16} />
          <span>View-only — only the Owner can add or edit inventory items.</span>
        </div>
      )}

      <div className="toolbar mb-16">
        <SearchBox value={q} onChange={setQ} placeholder="Search items…" style={{ width: 250 }} />
        <div className="segmented">
          <button className={catFilter === 'all' ? 'active' : ''} onClick={() => setCatFilter('all')}>All</button>
          {Object.entries(CATS).map(([k, c]) => (
            <button key={k} className={catFilter === k ? 'active' : ''} onClick={() => setCatFilter(k)}>{c.label}</button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 16 }}>{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 46, marginBottom: 8 }} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="cube" title="No inventory items" message="Add cameras, hard disks, stands and other equipment with their rent per event."
            action={canManage && <button className="btn btn--primary" onClick={() => setModal({ mode: 'create', item: empty })}><Icon name="plus" size={15} /> Add item</button>} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Item</th><th>Category</th><th>Brand</th><th style={{ textAlign: 'center' }}>Qty</th><th style={{ textAlign: 'right' }}>Rent / event</th><th>Notes</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const cat = CATS[item.category] || CATS.equipment;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="cell-user">
                          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-2)', color: cat.color, display: 'grid', placeItems: 'center' }}>
                            <Icon name={cat.icon} size={16} />
                          </span>
                          <div className="td-main">{item.name}</div>
                        </div>
                      </td>
                      <td><span className="muted">{cat.label}</span></td>
                      <td><span className="muted">{item.brand || '—'}</span></td>
                      <td style={{ textAlign: 'center' }}><b className="mono">{item.quantity}</b></td>
                      <td style={{ textAlign: 'right' }}><b className="mono">{money(item.rent_per_event)}</b></td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{item.notes || '—'}</td>
                      <td>
                        {canManage && (
                          <RowActions
                            canEdit={canManage} canDelete={canManage}
                            onEdit={() => setModal({ mode: 'edit', item })}
                            onDelete={() => setDeleting(item)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <ItemModal mode={modal.mode} item={modal.item} busy={busy} onClose={() => setModal(null)} onSave={save} />}
      <ConfirmDelete open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} name={deleting?.name} />
    </div>
  );
}

function ItemModal({ mode, item, busy, onClose, onSave }) {
  const [f, setF] = useState(item);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={mode === 'create' ? 'Add inventory item' : 'Edit inventory item'}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.name.trim()} onClick={() => onSave(f)}>
            {busy ? 'Saving…' : mode === 'create' ? 'Add item' : 'Save changes'}
          </button>
        </>
      }>
      <div className="form-grid">
        <div className="field span-2"><label>Item name <span className="req">*</span></label><input value={f.name} onChange={set('name')} placeholder="e.g. Sony A7 IV Mirrorless Camera" /></div>
        <div className="field"><label>Category</label>
          <select value={f.category} onChange={set('category')}>
            {Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
        </div>
        <div className="field"><label>Brand</label><input value={f.brand} onChange={set('brand')} placeholder="e.g. Sony, Manfrotto" /></div>
        <div className="field"><label>Quantity</label><input type="number" min="1" value={f.quantity} onChange={set('quantity')} /></div>
        <div className="field"><label>Rent per event (₹)</label><input type="number" min="0" value={f.rent_per_event} onChange={set('rent_per_event')} placeholder="0" /></div>
        <div className="field span-2"><label>Notes</label><textarea value={f.notes} onChange={set('notes')} placeholder="Condition, what's included…" /></div>
      </div>
    </Modal>
  );
}

function ConfirmDelete({ open, onClose, onConfirm, busy, name }) {
  return (
    <Modal open={open} onClose={onClose} title="Remove item?" size="sm"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--danger" disabled={busy} onClick={onConfirm}>{busy ? 'Removing…' : 'Remove'}</button>
        </>
      }>
      <p className="text-2" style={{ fontSize: 13.5 }}>"{name}" will be removed from inventory.</p>
    </Modal>
  );
}
