import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Avatar, Badge, EmptyState, PageHeader, Skeleton } from '../components/ui';
import { formatDate, todayISO } from '../lib/format';

export default function Attendance() {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const { data, loading, setData } = useApi('/attendance');
  const [userFilter, setUserFilter] = useState('all');
  const [busy, setBusy] = useState(false);

  const seesAll = can('attendance.view_all');
  const { data: employees } = useApi(seesAll ? '/employees' : null);

  const filtered = useMemo(() => (data || []).filter((a) => {
    if (seesAll && userFilter !== 'all' && a.user_id !== Number(userFilter)) return false;
    return true;
  }), [data, userFilter, seesAll]);

  const today = todayISO();
  const myToday = (data || []).find((a) => a.user_id === user?.id && a.date === today);

  const summary = useMemo(() => {
    const s = { present: 0, late: 0, wfh: 0, half_day: 0, leave: 0 };
    filtered.forEach((a) => { if (s[a.status] !== undefined) s[a.status] += 1; });
    return s;
  }, [filtered]);

  const check = async (action) => {
    setBusy(true);
    try {
      const row = await api.post('/attendance/check', { action });
      setData((d) => {
        const rest = (d || []).filter((a) => !(a.user_id === user?.id && a.date === today));
        return [row, ...rest];
      });
      toast(action === 'in' ? `Checked in at ${row.check_in}` : `Checked out at ${row.check_out}`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Attendance" sub={seesAll ? 'Team presence across the studio' : 'Your attendance record'}
        actions={
          <div className="flex gap-8">
            {myToday?.check_in && !myToday?.check_out && (
              <button className="btn btn--secondary" disabled={busy} onClick={() => check('out')}>
                <Icon name="logout" size={15} /> Check out
              </button>
            )}
            {!myToday?.check_in && (
              <button className="btn btn--primary" disabled={busy} onClick={() => check('in')}>
                <Icon name="clock" size={15} /> {busy ? 'Working…' : 'Check in'}
              </button>
            )}
            {myToday?.check_in && myToday?.check_out && (
              <span className="badge badge--green">Done for today · {myToday.check_in}–{myToday.check_out}</span>
            )}
          </div>
        } />

      <div className="stat-grid mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { k: 'present', label: 'Present', icon: 'checkCircle', tint: 'var(--success-soft)', color: 'var(--success)' },
          { k: 'late', label: 'Late', icon: 'clock', tint: 'var(--warning-soft)', color: 'var(--warning)' },
          { k: 'wfh', label: 'WFH', icon: 'home', tint: 'var(--violet-soft)', color: 'var(--violet)' },
          { k: 'half_day', label: 'Half day', icon: 'sun', tint: 'var(--info-soft)', color: 'var(--info)' },
          { k: 'leave', label: 'On leave', icon: 'calendar', tint: 'var(--danger-soft)', color: 'var(--danger)' },
        ].map((s) => (
          <div key={s.k} className="stat-card">
            <div className="stat-card__icon" style={{ background: s.tint, color: s.color }}><Icon name={s.icon === 'home' ? 'building' : s.icon} size={18} /></div>
            <div>
              <div className="stat-card__label">{s.label}</div>
              <div className="stat-card__value mono">{summary[s.k]}</div>
            </div>
          </div>
        ))}
      </div>

      {seesAll && (
        <div className="toolbar mb-16">
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
            style={{ font: 'inherit', fontSize: 13, padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', outline: 'none' }}>
            <option value="all">All members</option>
            {(employees || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div style={{ padding: 16 }}>{[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="calendarCheck" title="No attendance records yet" message="Check in to start tracking your presence." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  {seesAll && <th>Member</th>}
                  <th>Check in</th><th>Check out</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 60).map((a) => (
                  <tr key={a.id}>
                    <td><b>{formatDate(a.date)}</b></td>
                    {seesAll && (
                      <td>
                        <div className="cell-user">
                          <Avatar name={a.user_name} hue={a.user_hue} size="sm" />
                          <span style={{ fontWeight: 600 }}>{a.user_name}</span>
                        </div>
                      </td>
                    )}
                    <td className="mono">{a.check_in || '—'}</td>
                    <td className="mono">{a.check_out || '—'}</td>
                    <td><Badge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
