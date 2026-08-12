import { Fragment } from 'react';
import { useApi } from '../hooks/useApi';
import { Icon } from '../components/icons';
import { PageHeader, Skeleton } from '../components/ui';

const LEVEL_COLORS = {
  5: 'var(--grad)',
  4: 'var(--primary)',
  3: 'var(--info)',
  1: 'var(--text-3)',
};

const GROUP_ORDER = ['dashboard', 'employees', 'clients', 'projects', 'pipeline', 'tasks', 'assets', 'timesheets', 'attendance', 'payroll', 'activity', 'access'];

export default function AccessControl() {
  const { data, loading } = useApi('/employees/meta/roles');

  if (loading) return <div className="card" style={{ padding: 20 }}><Skeleton style={{ height: 400 }} /></div>;
  if (!data) return null;

  const { levels, labels, capabilities, matrix } = data;
  const roles = Object.keys(labels);

  const grouped = GROUP_ORDER
    .map((prefix) => ({ prefix, caps: capabilities.filter((c) => c.key.startsWith(prefix)) }))
    .filter((g) => g.caps.length);

  return (
    <div>
      <PageHeader title="Access control" sub="Role levels and permissions across the studio" />

      <div className="stat-grid mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {roles.map((r) => (
          <div key={r} className="stat-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <span className="level-pill" style={{ background: LEVEL_COLORS[levels[r]] === 'var(--grad)' ? 'var(--grad)' : undefined, color: levels[r] === 5 ? '#fff' : undefined, width: 34, height: 34, fontSize: 14 }}>
                {levels[r]}
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>{labels[r]}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>Access level {levels[r]}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="permission-note">
        <Icon name="shield" size={16} />
        <span>Higher access level = more capabilities. A role is granted everything at its level and below — this matrix is enforced on the API for every request.</span>
      </div>

      <div className="card">
        <div className="matrix-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Capability</th>
                {roles.map((r) => (
                  <th key={r} style={{ textAlign: 'center' }}>
                    <div style={{ textTransform: 'capitalize' }}>{labels[r]}</div>
                    <div style={{ fontWeight: 800, color: 'var(--primary)', textTransform: 'none', letterSpacing: 0 }}>L{levels[r]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <Fragment key={g.prefix}>
                  {g.caps.map((c, i) => (
                    <tr key={c.key} style={i === 0 ? { borderTop: '2px solid var(--border-strong)' } : undefined}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.label}</div>
                        <div className="muted" style={{ fontSize: 11, fontFamily: 'monospace' }}>{c.key}</div>
                      </td>
                      {roles.map((r) => (
                        <td key={r} className="perm-cell">
                          {matrix[r].includes(c.key) ? (
                            <span className="check-yes">✓</span>
                          ) : (
                            <span className="check-no">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr><td colSpan={roles.length + 1} style={{ padding: 4 }} /></tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
