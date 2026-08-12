import { useApi } from '../hooks/useApi';
import { Icon } from '../components/icons';
import { Avatar, EmptyState, PageHeader, Skeleton } from '../components/ui';
import { relativeTime } from '../lib/format';

const ACTION_ICONS = {
  created: 'plus', added: 'plus', updated: 'pencil', completed: 'checkCircle',
  moved: 'arrowRight', approved: 'check', rejected: 'x', submitted: 'send',
  uploaded: 'upload', removed: 'trash', signed: 'user', checked: 'clock',
  changed: 'refresh', processed: 'wallet', paid: 'banknote',
};

export default function ActivityLog() {
  const { data, loading } = useApi('/activity?limit=100');

  return (
    <div>
      <PageHeader title="Activity log" sub="Every action across the studio, newest first" />

      <div className="card">
        {loading ? (
          <div style={{ padding: 16 }}>{[...Array(10)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)}</div>
        ) : !data || data.length === 0 ? (
          <EmptyState icon="activity" title="No activity yet" message="Actions across the studio will appear here." />
        ) : (
          <div style={{ padding: '18px 20px' }}>
            <div className="timeline">
              {data.map((a) => (
                <div key={a.id} className="timeline-item flex" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="timeline-item__head">
                      <Avatar name={a.user_name} hue={a.avatar_hue} size="sm" style={{ verticalAlign: 'middle', marginRight: 8 }} />
                      <span style={{ fontWeight: 700 }}>{a.user_name || 'System'}</span>{' '}
                      <span className="text-2" style={{ fontWeight: 500, textTransform: 'capitalize' }}>{a.action}</span>
                      {a.target_type && <span className="muted" style={{ fontWeight: 500 }}>· {a.target_type}</span>}
                    </div>
                    <div className="timeline-item__sub">{a.details} · {relativeTime(a.created_at)}</div>
                  </div>
                  <span style={{ color: 'var(--text-3)', display: 'grid', placeItems: 'center' }}>
                    <Icon name={ACTION_ICONS[a.action.split(' ')[0]] || 'activity'} size={14} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
