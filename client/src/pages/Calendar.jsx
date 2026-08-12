import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Icon } from '../components/icons';
import { PageHeader, Skeleton } from '../components/ui';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_META = {
  shoot: { label: 'Shoot', color: '#6366f1', bg: '#eef0fe' },
  delivery: { label: 'Delivery', color: '#0ea371', bg: '#e3f7ef' },
  task: { label: 'Task', color: '#d97706', bg: '#fdf3e3' },
  invoice: { label: 'Invoice due', color: '#dc2626', bg: '#fdeaea' },
};

export default function Calendar() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const navigate = useNavigate();
  const { data, loading } = useApi(`/calendar?month=${month}`);

  const grid = useMemo(() => {
    if (!data) return [];
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    // Monday-first
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${month}-${String(d).padStart(2, '0')}`;
      const today = iso === new Date().toISOString().slice(0, 10);
      cells.push({ day: d, iso, events: (data.events || []).filter((e) => e.date === iso), today });
    }
    return cells;
  }, [data, month]);

  const counts = data?.counts || {};
  const nav = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const openEvent = (e) => {
    if (e.link_type === 'project') navigate(`/projects/${e.link_id}`);
    else if (e.link_type === 'task') navigate('/tasks');
    else if (e.link_type === 'invoice') navigate('/invoices');
  };

  return (
    <div>
      <PageHeader title="Studio calendar" sub="Shoots, deliveries, task deadlines & invoice dues"
        actions={
          <div className="flex gap-8">
            <button className="btn btn--secondary btn--sm" onClick={() => nav(-1)}><Icon name="chevronLeft" size={14} /></button>
            <button className="btn btn--secondary btn--sm" onClick={() => setMonth(new Date().toISOString().slice(0, 7))}>Today</button>
            <button className="btn btn--secondary btn--sm" onClick={() => nav(1)}><Icon name="chevronRight" size={14} /></button>
          </div>
        } />

      <div className="flex gap-16 mb-12" style={{ flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>{new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
        {Object.entries(TYPE_META).map(([k, m]) => (
          <span key={k} className="flex gap-6"><i style={{ width: 9, height: 9, borderRadius: 3, background: m.color, display: 'inline-block' }} /> {m.label} ({counts[k] ?? 0})</span>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 16 }}><Skeleton style={{ height: 480 }} /></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minWidth: 760 }}>
              {DAY_NAMES.map((d) => (
                <div key={d} style={{ padding: '10px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>{d}</div>
              ))}
              {grid.map((cell, i) => (
                <div key={i} style={{
                  minHeight: 108, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                  padding: 6, background: cell?.today ? 'var(--primary-soft)' : cell ? '#fff' : 'var(--surface-2)',
                }}>
                  {cell && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: cell.today ? 'var(--primary-strong)' : 'var(--text-2)', marginBottom: 4 }}>{cell.day}</div>
                      {cell.events.slice(0, 4).map((e, j) => (
                        <button key={j} onClick={() => openEvent(e)} title={e.title}
                          style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderRadius: 6, padding: '3px 6px', marginBottom: 3, fontSize: 11, fontWeight: 600, background: TYPE_META[e.type].bg, color: TYPE_META[e.type].color, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.title.length > 22 ? e.title.slice(0, 22) + '…' : e.title}
                        </button>
                      ))}
                      {cell.events.length > 4 && <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600, paddingLeft: 2 }}>+{cell.events.length - 4} more</div>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
