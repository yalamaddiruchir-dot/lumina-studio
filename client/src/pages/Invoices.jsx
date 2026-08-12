import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Badge, EmptyState, Modal, PageHeader, SearchBox, Skeleton } from '../components/ui';
import { money, formatDate } from '../lib/format';

export default function Invoices() {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data, loading, setData } = useApi('/invoices');
  const { data: projects } = useApi('/projects');
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const canManage = can('invoices.manage');

  const filtered = useMemo(() => (data || []).filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (q && !`${i.invoice_no} ${i.client_name} ${i.project_name}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [data, q, statusFilter]);

  const totals = useMemo(() => {
    const t = { total: 0, gst: 0, collected: 0, outstanding: 0 };
    (data || []).forEach((i) => {
      t.total += i.total_amount;
      t.gst += i.gst_amount;
      t.collected += i.advance_paid;
      t.outstanding += i.balance;
    });
    return t;
  }, [data]);

  const recordPayment = async (form) => {
    setBusy(true);
    try {
      await api.post(`/invoices/${payTarget.id}/payments`, form);
      toast(`Payment of ${money(Number(form.amount))} recorded`);
      setPayTarget(null);
      setRefreshKey((k) => k + 1);
      setData((d) => (d || []).map((i) => (i.id === payTarget.id ? { ...i, status: 'paid' } : i)));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const create = async (form) => {
    setBusy(true);
    try {
      const created = await api.post('/invoices', form);
      setData((d) => [created, ...(d || [])]);
      toast(`Invoice ${created.invoice_no} created`);
      setCreateModal(false);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Invoices" sub="GST invoicing & payment tracking"
        actions={canManage && <button className="btn btn--primary" onClick={() => setCreateModal(true)}><Icon name="plus" size={16} /> New invoice</button>} />

      <div className="stat-grid mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Icon name="banknote" size={20} /></div>
          <div><div className="stat-card__label">Invoiced (incl. GST)</div><div className="stat-card__value mono">{money(totals.total)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="scale" size={20} /></div>
          <div><div className="stat-card__label">GST collected</div><div className="stat-card__value mono">{money(totals.gst)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}><Icon name="checkCircle" size={20} /></div>
          <div><div className="stat-card__label">Collected</div><div className="stat-card__value mono">{money(totals.collected)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="alert" size={20} /></div>
          <div><div className="stat-card__label">Outstanding</div><div className="stat-card__value mono">{money(totals.outstanding)}</div></div>
        </div>
      </div>

      <div className="toolbar mb-16">
        <SearchBox value={q} onChange={setQ} placeholder="Search invoices…" style={{ width: 250 }} />
        <div className="segmented">
          {['all', 'draft', 'sent', 'partial', 'paid', 'overdue'].map((s) => (
            <button key={s} className={statusFilter === s ? 'active' : ''} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 16 }}>{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 46, marginBottom: 8 }} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="banknote" title="No invoices" message="Create an invoice from an order to start tracking GST and payments."
            action={canManage && <button className="btn btn--primary" onClick={() => setCreateModal(true)}><Icon name="plus" size={15} /> New invoice</button>} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice</th><th>Client / Order</th><th>Issued</th><th>Due</th>
                  <th style={{ textAlign: 'right' }}>Base</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(inv.id)}>
                    <td><b className="mono">{inv.invoice_no}</b></td>
                    <td>
                      <div className="td-main">{inv.client_name || '—'}</div>
                      <div className="td-sub">{inv.project_name}</div>
                    </td>
                    <td className="muted">{formatDate(inv.issued_on)}</td>
                    <td className="muted">{formatDate(inv.due_on)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{money(inv.base_amount)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{money(inv.gst_amount)}</td>
                    <td style={{ textAlign: 'right' }}><b className="mono">{money(inv.total_amount)}</b></td>
                    <td style={{ textAlign: 'right', color: inv.balance > 0 ? 'var(--danger)' : 'var(--success)' }} className="mono">{money(inv.balance)}</td>
                    <td><Badge status={inv.status} /></td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn--sm btn--secondary" onClick={(e) => { e.stopPropagation(); setDetailId(inv.id); }}><Icon name="eye" size={13} /> View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createModal && <CreateInvoiceModal projects={projects || []} busy={busy} onClose={() => setCreateModal(false)} onSave={create} />}
      {detailId && <InvoiceDetail id={detailId} refreshKey={refreshKey} onClose={() => setDetailId(null)} canManage={canManage} onRecord={setPayTarget} />}
      {payTarget && <PaymentModal balance={payTarget.balance} busy={busy} onClose={() => setPayTarget(null)} onSave={recordPayment} />}
    </div>
  );
}

function CreateInvoiceModal({ projects, busy, onClose, onSave }) {
  const [f, setF] = useState({ project_id: '', base_amount: '', gst_rate: '18', advance_paid: '0', issued_on: new Date().toISOString().slice(0, 10), due_on: '', notes: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const base = Number(f.base_amount) || 0;
  const gst = Math.round(base * (Number(f.gst_rate) || 0) / 100 * 100) / 100;
  const total = base + gst;
  return (
    <Modal open onClose={onClose} size="lg" title="New GST invoice"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.project_id || base <= 0} onClick={() => onSave(f)}>
            {busy ? 'Creating…' : 'Create invoice'}
          </button>
        </>
      }>
      <div className="form-grid">
        <div className="field span-2"><label>Order <span className="req">*</span></label>
          <select value={f.project_id} onChange={set('project_id')}>
            <option value="">Select an order…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.client_name || 'No client'}</option>)}
          </select>
        </div>
        <div className="field"><label>Base amount (₹) <span className="req">*</span></label><input type="number" value={f.base_amount} onChange={set('base_amount')} placeholder="0" /></div>
        <div className="field"><label>GST rate (%)</label>
          <select value={f.gst_rate} onChange={set('gst_rate')}>
            {['0', '5', '12', '18', '28'].map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>
        <div className="field"><label>Issued on</label><input type="date" value={f.issued_on} onChange={set('issued_on')} /></div>
        <div className="field"><label>Due on</label><input type="date" value={f.due_on} onChange={set('due_on')} /></div>
        <div className="field span-2"><label>Advance paid (₹)</label><input type="number" value={f.advance_paid} onChange={set('advance_paid')} placeholder="0" /></div>
        <div className="field span-2"><label>Notes</label><textarea value={f.notes} onChange={set('notes')} /></div>
        <div className="span-2" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <span className="text-2" style={{ fontSize: 13 }}>Base: <b className="mono">{money(base)}</b></span>
          <span className="text-2" style={{ fontSize: 13 }}>GST ({f.gst_rate}%): <b className="mono">{money(gst)}</b></span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>Total: <span className="mono">{money(total)}</span></span>
        </div>
      </div>
    </Modal>
  );
}

function InvoiceDetail({ id, refreshKey, onClose, canManage, onRecord }) {
  const { data, loading } = useApi(`/invoices/${id}`, [refreshKey]);

  if (loading) return <Modal open onClose={onClose} title="Invoice"><div style={{ padding: 20 }}><Skeleton style={{ height: 200 }} /></div></Modal>;
  if (!data) return null;

  return (
    <Modal open onClose={onClose} size="lg"
      title={<span className="mono">{data.invoice_no}</span>}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Close</button>
          {canManage && data.balance > 0 && (
            <button className="btn btn--primary" onClick={() => onRecord({ id: data.id, balance: data.balance })}><Icon name="banknote" size={15} /> Record payment</button>
          )}
        </>
      }>
      <div className="flex-between mb-12" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{data.client_name || 'Client'}</div>
          <div className="muted" style={{ fontSize: 13 }}>{data.project_name}</div>
        </div>
        <Badge status={data.status} />
      </div>
      <div className="kv"><span>Issued</span><span>{formatDate(data.issued_on)}</span></div>
      <div className="kv"><span>Due</span><span>{formatDate(data.due_on)}</span></div>
      <div className="kv"><span>Base amount</span><span className="mono">{money(data.base_amount)}</span></div>
      <div className="kv"><span>GST ({data.gst_rate}%)</span><span className="mono">{money(data.gst_amount)}</span></div>
      <div className="kv"><span>Total (incl. GST)</span><span className="mono" style={{ fontWeight: 800 }}>{money(data.total_amount)}</span></div>
      <div className="kv"><span>Advance / collected</span><span className="mono" style={{ color: 'var(--success)' }}>{money(data.advance_paid)}</span></div>
      <div className="kv"><span>Balance</span><span className="mono" style={{ color: data.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{money(data.balance)}</span></div>
      {data.notes && <p className="text-2" style={{ marginTop: 10, fontSize: 13 }}>{data.notes}</p>}

      <div className="card__title mt-16 mb-8">Payments ({data.payments?.length || 0})</div>
      {(data.payments?.length || 0) === 0 && <p className="muted" style={{ fontSize: 13 }}>No payments recorded yet.</p>}
      {(data.payments || []).map((p) => (
        <div key={p.id} className="flex-between" style={{ padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
          <div>
            <b className="mono">{money(p.amount)}</b>
            <span className="muted" style={{ marginLeft: 8, textTransform: 'capitalize' }}>{p.method}</span>
            {p.reference && <span className="muted" style={{ marginLeft: 6 }}>· {p.reference}</span>}
          </div>
          <div className="muted">{formatDate(p.paid_on)} · {p.recorded_by_name || '—'}</div>
        </div>
      ))}

    </Modal>
  );
}

function PaymentModal({ balance, busy, onClose, onSave }) {
  const [f, setF] = useState({ amount: String(Math.round(balance)), method: 'bank', paid_on: new Date().toISOString().slice(0, 10), reference: '', notes: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open top onClose={onClose} title="Record payment" size="sm"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || Number(f.amount) <= 0 || Number(f.amount) > balance} onClick={() => onSave(f)}>
            {busy ? 'Saving…' : 'Record payment'}
          </button>
        </>
      }>
      <p className="muted mb-12" style={{ fontSize: 13 }}>Outstanding balance: <b className="mono" style={{ color: 'var(--text)' }}>{money(balance)}</b></p>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="field"><label>Amount (₹)</label><input type="number" value={f.amount} onChange={set('amount')} /></div>
        <div className="field"><label>Method</label>
          <select value={f.method} onChange={set('method')}>
            {['cash', 'bank', 'upi', 'card', 'cheque'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="field"><label>Paid on</label><input type="date" value={f.paid_on} onChange={set('paid_on')} /></div>
        <div className="field"><label>Reference (transaction id / cheque no.)</label><input value={f.reference} onChange={set('reference')} /></div>
        <div className="field"><label>Notes</label><textarea value={f.notes} onChange={set('notes')} /></div>
      </div>
    </Modal>
  );
}
