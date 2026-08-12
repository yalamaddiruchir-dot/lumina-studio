import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, getToken } from '../lib/api';
import { Icon } from '../components/icons';
import { Avatar, Badge, EmptyState, Modal, PageHeader, Skeleton } from '../components/ui';
import { money, formatDate } from '../lib/format';

const EST_STATUS = ['draft', 'sent', 'accepted', 'rejected', 'cancelled'];

export default function Estimations() {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data, loading, setData } = useApi('/estimates');
  const [createModal, setCreateModal] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [busy, setBusy] = useState(false);

  const canManage = can('estimates.manage');

  const create = async (form) => {
    setBusy(true);
    try {
      const created = await api.post('/estimates', form);
      setData((d) => [created, ...(d || [])]);
      toast(`Estimate ${created.estimate_no} created`);
      setCreateModal(false);
      setDetailId(created.id);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Estimations" sub="Event cost quotations — cameras, team & equipment"
        actions={canManage && <button className="btn btn--primary" onClick={() => setCreateModal(true)}><Icon name="plus" size={16} /> New estimation</button>} />

      <div className="card">
        {loading ? (
          <div style={{ padding: 16 }}>{[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />)}</div>
        ) : (data || []).length === 0 ? (
          <EmptyState icon="file" title="No estimations yet" message="Create an estimate for a client event with cameras, team and equipment."
            action={canManage && <button className="btn btn--primary" onClick={() => setCreateModal(true)}><Icon name="plus" size={15} /> New estimation</button>} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Estimate</th><th>Client / Event</th><th>Event date</th><th>Team</th>
                  <th style={{ textAlign: 'right' }}>Total (incl. GST)</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e) => (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(e.id)}>
                    <td><b className="mono">{e.estimate_no}</b></td>
                    <td>
                      <div className="td-main">{e.event_name}</div>
                      <div className="td-sub">{e.client_name || '—'} · {e.event_type || ''}</div>
                    </td>
                    <td className="muted">{formatDate(e.event_date)} · {e.days}d</td>
                    <td><span className="mono">{e.team_count}</span> members</td>
                    <td style={{ textAlign: 'right' }}><b className="mono">{money(e.total)}</b></td>
                    <td><Badge status={e.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-6" style={{ justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" style={{ width: 30, height: 30 }} title="Download PDF" onClick={() => downloadPdf(e.id)}>
                          <Icon name="download" size={14} />
                        </button>
                        <button className="btn btn--sm btn--secondary" onClick={() => setDetailId(e.id)}><Icon name="eye" size={13} /> View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createModal && <EstimateModal clients={{}} busy={busy} onClose={() => setCreateModal(false)} onSave={create} />}
      {detailId && <EstimateDetail id={detailId} onClose={() => setDetailId(null)} canManage={canManage} />}
    </div>
  );
}

async function downloadPdf(id) {
  try {
    const res = await fetch(`/api/estimates/${id}/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error('Could not download PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estimate-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e.message);
  }
}

/* ---------- Create estimation modal ---------- */
function EstimateModal({ busy, onClose, onSave }) {
  const { data: clients } = useApi('/clients');
  const { data: inventory } = useApi('/inventory');
  const [f, setF] = useState({
    client_id: '', event_name: '', event_type: 'Wedding', event_date: '', days: '1',
    cameras: '1', camera_rate: '1500', employee_rate: '2500',
    extras_label: '', extras_cost: '0', notes: '', status: 'draft',
  });
  const [employeeIds, setEmployeeIds] = useState([]);
  const [equipment, setEquipment] = useState({}); // inventory_id -> qty
  const [avail, setAvail] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (!f.event_date) { setAvail(null); return; }
    let alive = true;
    api.get(`/employees/available?date=${f.event_date}`)
      .then((d) => { if (alive) { setAvail(d); setEmployeeIds([]); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [f.event_date]);

  const toggleEmployee = (id) =>
    setEmployeeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const toggleEquip = (item) =>
    setEquipment((eq) => {
      const next = { ...eq };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = 1;
      return next;
    });
  const setQty = (id, qty) => setEquipment((eq) => ({ ...eq, [id]: Math.max(1, Number(qty) || 1) }));

  // Live costing
  const days = Math.max(Number(f.days) || 1, 1);
  const cameraCost = (Number(f.cameras) || 0) * (Number(f.camera_rate) || 0) * days;
  const employeeCost = employeeIds.length * (Number(f.employee_rate) || 0) * days;
  const equipmentCost = Object.entries(equipment).reduce((sum, [id, qty]) => {
    const item = (inventory || []).find((x) => x.id === Number(id));
    return sum + (item ? item.rent_per_event * qty * days : 0);
  }, 0);
  const extrasCost = Number(f.extras_cost) || 0;
  const subtotal = cameraCost + employeeCost + equipmentCost + extrasCost;
  const gst = Math.round(subtotal * 18) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;

  const save = () => onSave({
    ...f,
    days, cameras: Number(f.cameras) || 0,
    camera_rate: Number(f.camera_rate) || 0, employee_rate: Number(f.employee_rate) || 0,
    extras_cost: extrasCost,
    employee_ids: employeeIds,
    equipment: Object.entries(equipment).map(([id, qty]) => ({ id: Number(id), qty })),
  });

  return (
    <Modal open onClose={onClose} size="lg" title="New estimation"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.event_name.trim()} onClick={save}>
            {busy ? 'Creating…' : 'Create estimate'}
          </button>
        </>
      }>
      <div className="form-grid">
        <div className="field"><label>Client</label>
          <select value={f.client_id} onChange={set('client_id')}>
            <option value="">Select client…</option>
            {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Event type</label>
          <select value={f.event_type} onChange={set('event_type')}>
            {['Wedding', 'Pre-Wedding', 'Engagement', 'Anniversary', 'Corporate', 'Event', 'Portrait', 'Other'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field span-2"><label>Event name <span className="req">*</span></label>
          <input value={f.event_name} onChange={set('event_name')} placeholder="e.g. Rohan & Sneha Wedding — Full Coverage" />
        </div>
        <div className="field"><label>Event date</label>
          <input type="date" value={f.event_date} onChange={set('event_date')} />
        </div>
        <div className="field"><label>Days</label><input type="number" min="1" value={f.days} onChange={set('days')} /></div>
        <div className="field"><label>No. of cameras</label><input type="number" min="0" value={f.cameras} onChange={set('cameras')} /></div>
        <div className="field"><label>Camera rate (₹/day)</label><input type="number" min="0" value={f.camera_rate} onChange={set('camera_rate')} /></div>
        <div className="field span-2"><label>Team member rate (₹/day)</label><input type="number" min="0" value={f.employee_rate} onChange={set('employee_rate')} /></div>
      </div>

      {/* Team availability */}
      <div className="card__title mt-16 mb-8">Team for the event <span className="muted" style={{ fontWeight: 600 }}>({employeeIds.length} selected)</span></div>
      {!f.event_date ? (
        <p className="muted" style={{ fontSize: 13 }}>Pick an event date to see who's available.</p>
      ) : !avail ? (
        <Skeleton style={{ height: 70 }} />
      ) : (
        <>
          {avail.available.length === 0 && <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>No team members free on {f.event_date}.</p>}
          <div className="flex gap-8 mb-8" style={{ flexWrap: 'wrap' }}>
            {avail.available.map((u) => (
              <button key={u.id}
                onClick={() => toggleEmployee(u.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: employeeIds.includes(u.id) ? '1.5px solid var(--primary)' : '1px solid var(--border-strong)', background: employeeIds.includes(u.id) ? 'var(--primary-soft)' : 'var(--surface)', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                <Avatar name={u.name} hue={u.avatar_hue} size="sm" />
                <span>{u.name}</span>
                <span className="muted" style={{ fontWeight: 500, fontSize: 11 }}>{u.position || u.role}</span>
                {employeeIds.includes(u.id) && <span style={{ color: 'var(--primary)' }}><Icon name="check" size={13} /></span>}
              </button>
            ))}
          </div>
          {avail.busy.length > 0 && (
            <p className="muted" style={{ fontSize: 12 }}>
              <b>Booked on this date:</b> {avail.busy.map((u) => u.name).join(', ')}
            </p>
          )}
        </>
      )}

      {/* Equipment from inventory */}
      <div className="card__title mt-16 mb-8">Equipment (from inventory)</div>
      {(inventory || []).length === 0 && <p className="muted" style={{ fontSize: 13 }}>No equipment in inventory yet — the owner can add cameras, hard disks & stands.</p>}
      <div className="flex gap-8 mb-12" style={{ flexWrap: 'wrap' }}>
        {(inventory || []).map((item) => (
          <div key={item.id} style={{ border: equipment[item.id] ? '1.5px solid var(--primary)' : '1px solid var(--border-strong)', borderRadius: 10, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8, background: equipment[item.id] ? 'var(--primary-soft)' : 'var(--surface)' }}>
            <button onClick={() => toggleEquip(item)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: 0 }}>
              <Icon name={item.category === 'camera' ? 'camera' : item.category === 'hard_disk' ? 'cube' : item.category === 'stand' ? 'target' : 'zap'} size={15} />
              <span>{item.name}</span>
              <span className="muted" style={{ fontWeight: 500, fontSize: 11 }}>₹{item.rent_per_event}/day</span>
            </button>
            {equipment[item.id] && (
              <input type="number" min="1" value={equipment[item.id]} onChange={(e) => setQty(item.id, e.target.value)}
                style={{ width: 52, padding: '3px 6px', borderRadius: 7, border: '1px solid var(--border-strong)', fontSize: 12, font: 'inherit' }} />
            )}
          </div>
        ))}
      </div>

      {/* Extras + summary */}
      <div className="form-grid">
        <div className="field"><label>Extras label</label><input value={f.extras_label} onChange={set('extras_label')} placeholder="e.g. Drone shots, extra album pages" /></div>
        <div className="field"><label>Extras cost (₹)</label><input type="number" min="0" value={f.extras_cost} onChange={set('extras_cost')} /></div>
        <div className="field span-2"><label>Notes / terms</label><textarea value={f.notes} onChange={set('notes')} placeholder="Inclusions, exclusions, advance policy…" /></div>
      </div>

      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px', marginTop: 14 }}>
        <div className="flex-between" style={{ fontSize: 13 }}>
          <span className="text-2">Cameras ({f.cameras} × ₹{f.camera_rate} × {days}d)</span><b className="mono">{money(cameraCost)}</b>
        </div>
        <div className="flex-between" style={{ fontSize: 13 }}>
          <span className="text-2">Team ({employeeIds.length} × ₹{f.employee_rate} × {days}d)</span><b className="mono">{money(employeeCost)}</b>
        </div>
        <div className="flex-between" style={{ fontSize: 13 }}>
          <span className="text-2">Equipment</span><b className="mono">{money(equipmentCost)}</b>
        </div>
        <div className="flex-between" style={{ fontSize: 13 }}>
          <span className="text-2">Extras</span><b className="mono">{money(extrasCost)}</b>
        </div>
        <div className="flex-between" style={{ fontSize: 13, borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
          <span className="text-2">Subtotal</span><b className="mono">{money(subtotal)}</b>
        </div>
        <div className="flex-between" style={{ fontSize: 13 }}>
          <span className="text-2">GST (18%)</span><b className="mono">{money(gst)}</b>
        </div>
        <div className="flex-between" style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
          <span>Total</span><span className="mono" style={{ color: 'var(--primary)' }}>{money(total)}</span>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Estimate detail ---------- */
function EstimateDetail({ id, onClose, canManage }) {
  const { toast } = useToast();
  const { data, loading, setData } = useApi(`/estimates/${id}`);
  const [busy, setBusy] = useState(false);

  const changeStatus = async (status) => {
    setBusy(true);
    try {
      const updated = await api.patch(`/estimates/${id}`, { status });
      setData((d) => ({ ...d, ...updated }));
      toast(`Estimate marked ${status}`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Modal open onClose={onClose} title="Estimate"><div style={{ padding: 20 }}><Skeleton style={{ height: 260 }} /></div></Modal>;
  if (!data) return null;

  return (
    <Modal open onClose={onClose} size="lg"
      title={<span className="mono">{data.estimate_no}</span>}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Close</button>
          <button className="btn btn--primary" onClick={() => downloadPdf(data.id)}><Icon name="download" size={15} /> Download PDF</button>
        </>
      }>
      <div className="flex-between mb-12" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{data.event_name}</div>
          <div className="muted" style={{ fontSize: 13 }}>{data.client_name || 'Client'} · {data.event_type || ''} · {formatDate(data.event_date)} · {data.days}d</div>
        </div>
        <Badge status={data.status} />
      </div>

      {canManage && data.status !== 'accepted' && data.status !== 'rejected' && data.status !== 'cancelled' && (
        <div className="flex gap-8 mb-12">
          {['sent', 'accepted', 'rejected'].map((s) => (
            <button key={s} className={`btn btn--sm ${s === 'sent' ? 'btn--secondary' : s === 'accepted' ? 'btn--primary' : 'btn--danger-ghost'}`} disabled={busy} onClick={() => changeStatus(s)}>
              Mark {s}
            </button>
          ))}
        </div>
      )}

      <div className="kv"><span>Company</span><span>{data.company_name} · License {data.company_license}</span></div>
      <div className="kv"><span>Cameras</span><span className="mono">{data.cameras} × ₹{data.camera_rate}/day × {data.days}d</span></div>
      <div className="kv"><span>Camera cost</span><span className="mono">{money(data.cameras * data.camera_rate * Math.max(data.days, 1))}</span></div>
      <div className="kv"><span>Team ({data.team_count})</span><span className="mono">₹{data.employee_rate}/day each</span></div>
      <div className="kv"><span>Equipment cost</span><span className="mono">{money(data.equipment_cost)}</span></div>
      {data.extras_cost > 0 && <div className="kv"><span>Extras</span><span className="mono">{data.extras_label || 'Extras'} — {money(data.extras_cost)}</span></div>}
      <div className="kv"><span>Subtotal</span><span className="mono">{money(data.subtotal)}</span></div>
      <div className="kv"><span>GST ({data.gst_rate}%)</span><span className="mono">{money(data.gst_amount)}</span></div>
      <div className="kv"><span>Total</span><span className="mono" style={{ fontWeight: 800, color: 'var(--primary)' }}>{money(data.total)}</span></div>

      <div className="card__title mt-16 mb-8">Team ({data.team?.length || 0})</div>
      <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
        {(data.team || []).map((u) => (
          <span key={u.id} className="flex gap-6" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 9px', fontSize: 12.5, fontWeight: 600 }}>
            <Avatar name={u.name} hue={u.avatar_hue} size="sm" /> {u.name} <span className="muted" style={{ fontWeight: 500 }}>{u.position || u.role}</span>
          </span>
        ))}
      </div>

      <div className="card__title mt-16 mb-8">Equipment ({data.equipment?.length || 0})</div>
      {(data.equipment || []).map((eq) => (
        <div key={eq.inventory_id} className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
          <span>{eq.name} <span className="muted">× {eq.qty}</span></span>
          <b className="mono">{money(eq.rent * eq.qty * Math.max(data.days, 1))}</b>
        </div>
      ))}

      {data.notes && <p className="text-2" style={{ marginTop: 12, fontSize: 13 }}>{data.notes}</p>}
    </Modal>
  );
}
