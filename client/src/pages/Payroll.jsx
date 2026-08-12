import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Avatar, Badge, EmptyState, PageHeader, Skeleton } from '../components/ui';
import { money } from '../lib/format';

export default function Payroll() {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data, loading, setData } = useApi('/payroll');
  const [month, setMonth] = useState('all');

  const canManage = can('payroll.manage');

  const months = (data?.months || []);
  const rows = useMemo(() => {
    const all = data?.rows || [];
    return month === 'all' ? all : all.filter((r) => r.month === month);
  }, [data, month]);

  const totals = useMemo(() => {
    const t = { base: 0, bonus: 0, deductions: 0, net: 0 };
    rows.forEach((r) => {
      t.base += r.base_salary; t.bonus += r.bonus || 0; t.deductions += r.deductions || 0; t.net += r.net;
    });
    return t;
  }, [rows]);

  const paidCount = rows.filter((r) => r.status === 'paid').length;

  const mark = async (r, status) => {
    const prev = r.status;
    setData((d) => ({ ...d, rows: d.rows.map((x) => (x.id === r.id ? { ...x, status } : x)) })); // optimistic
    try {
      await api.patch(`/payroll/${r.id}/status`, { status });
      toast(status === 'paid' ? `Payroll marked paid for ${r.user_name}` : 'Returned to draft');
    } catch (e) {
      setData((d) => ({ ...d, rows: d.rows.map((x) => (x.id === r.id ? { ...x, status: prev } : x)) }));
      toast(e.message, 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Payroll" sub="Monthly compensation across the team"
        actions={
          months.length > 0 && (
            <select value={month} onChange={(e) => setMonth(e.target.value)}
              style={{ font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', outline: 'none' }}>
              <option value="all">All months</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )
        } />

      {!canManage && (
        <div className="permission-note permission-note--warn">
          <Icon name="lock" size={16} />
          <span>You have view-only access to payroll. Only the Owner and Finance roles can mark records as paid.</span>
        </div>
      )}

      <div className="stat-grid mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Icon name="wallet" size={20} /></div>
          <div><div className="stat-card__label">Net payout</div><div className="stat-card__value mono">{money(totals.net)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}><Icon name="trendingUp" size={20} /></div>
          <div><div className="stat-card__label">Bonuses</div><div className="stat-card__value mono">{money(totals.bonus)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="scale" size={20} /></div>
          <div><div className="stat-card__label">Deductions</div><div className="stat-card__value mono">{money(totals.deductions)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="banknote" size={20} /></div>
          <div><div className="stat-card__label">Paid this view</div><div className="stat-card__value mono">{paidCount}<span style={{ fontSize: 13, color: 'var(--text-3)' }}> / {rows.length}</span></div></div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 16 }}>{[...Array(9)].map((_, i) => <div key={i} className="skeleton" style={{ height: 46, marginBottom: 8 }} />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon="wallet" title="No payroll records" message="Payroll records appear once the month is processed." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Month</th><th>Employee</th>
                  <th style={{ textAlign: 'right' }}>Base</th>
                  <th style={{ textAlign: 'right' }}>Bonus</th>
                  <th style={{ textAlign: 'right' }}>Deductions</th>
                  <th style={{ textAlign: 'right' }}>Net</th>
                  <th>Status</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><b className="mono">{r.month}</b></td>
                    <td>
                      <div className="cell-user">
                        <Avatar name={r.user_name} hue={r.avatar_hue} size="sm" />
                        <div>
                          <div className="td-main">{r.user_name}</div>
                          <div className="td-sub">{r.department}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">{money(r.base_salary)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }} className="mono">{r.bonus ? `+${money(r.bonus)}` : '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)' }} className="mono">{r.deductions ? `−${money(r.deductions)}` : '—'}</td>
                    <td style={{ textAlign: 'right' }}><b className="mono">{money(r.net)}</b></td>
                    <td><Badge status={r.status} /></td>
                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        {r.status === 'draft' ? (
                          <button className="btn btn--sm btn--primary" onClick={() => mark(r, 'paid')}><Icon name="check" size={13} /> Mark paid</button>
                        ) : (
                          <button className="btn btn--sm btn--secondary" onClick={() => mark(r, 'draft')}>To draft</button>
                        )}
                      </td>
                    )}
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
