import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon, ASSET_ICONS, ASSET_COLORS } from '../components/icons';
import { Badge, EmptyState, Modal, ConfirmDialog, PageHeader, SearchBox, Skeleton } from '../components/ui';
import { formatDate, relativeTime } from '../lib/format';

const TYPES = [
  { key: 'video', label: 'Video' }, { key: 'image', label: 'Image' }, { key: 'audio', label: 'Audio' },
  { key: 'document', label: 'Document' }, { key: 'design', label: 'Design' }, { key: '3d', label: '3D / Motion' },
];

export default function Assets() {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data, loading, setData } = useApi('/assets');
  const { data: projects } = useApi('/projects');
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => (data || []).filter((a) => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [data, q, typeFilter]);

  const save = async (form) => {
    setBusy(true);
    try {
      const created = await api.post('/assets', form);
      setData((d) => [created, ...(d || [])]);
      toast('Asset added to library');
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
      await api.del(`/assets/${deleting.id}`);
      setData((d) => d.filter((a) => a.id !== deleting.id));
      toast('Asset removed');
      setDeleting(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Media assets" sub={`${filtered.length} file${filtered.length === 1 ? '' : 's'} in the library`}
        actions={can('assets.upload') && <button className="btn btn--primary" onClick={() => setModal(true)}><Icon name="upload" size={16} /> Upload asset</button>} />

      <div className="toolbar mb-16">
        <SearchBox value={q} onChange={setQ} placeholder="Search assets…" style={{ width: 250 }} />
        <div className="segmented">
          <button className={typeFilter === 'all' ? 'active' : ''} onClick={() => setTypeFilter('all')}>All</button>
          {TYPES.map((t) => (
            <button key={t.key} className={typeFilter === t.key ? 'active' : ''} onClick={() => setTypeFilter(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="asset-grid">{[...Array(8)].map((_, i) => <div key={i} className="card"><Skeleton style={{ height: 180 }} /></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon="film" title={q || typeFilter !== 'all' ? 'No matching assets' : 'The library is empty'}
            message={q || typeFilter !== 'all' ? 'Try a different search or filter.' : 'Upload renders, stills, decks and more.'}
            action={can('assets.upload') && <button className="btn btn--primary" onClick={() => setModal(true)}><Icon name="upload" size={15} /> Upload asset</button>} />
        </div>
      ) : (
        <div className="asset-grid">
          {filtered.map((a) => {
            const color = ASSET_COLORS[a.type] || '#64748b';
            return (
              <div key={a.id} className="asset-card">
                <div className="asset-card__thumb" style={{ ['--thumb-hue']: `hsl(${a.hue} 28% 92%)` }}>
                  <Icon name={ASSET_ICONS[a.type] || 'file'} size={38} style={{ color }} strokeWidth={1.6} />
                  <span className="asset-card__type" style={{ color }}>{a.type}</span>
                </div>
                <div className="asset-card__body">
                  <div className="asset-card__name" title={a.name}>{a.name}</div>
                  <div className="asset-card__meta">
                    <span>{a.size_mb >= 1024 ? `${(a.size_mb / 1024).toFixed(1)} GB` : `${a.size_mb} MB`}</span>
                    <span>{a.uploader_name || '—'} · {relativeTime(a.uploaded_at)}</span>
                  </div>
                  {a.tags && (
                    <div className="asset-card__tags">
                      {a.tags.split(',').slice(0, 3).map((t) => <span key={t} className="asset-tag">#{t.trim()}</span>)}
                    </div>
                  )}
                  <div className="flex-between mt-12">
                    <span className="muted" style={{ fontSize: 11.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {a.project_name || 'No project'}
                    </span>
                    {can('assets.delete') && (
                      <button className="icon-btn" style={{ width: 26, height: 26, color: 'var(--text-3)' }} onClick={() => setDeleting(a)} title="Delete">
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <AssetModal projects={projects || []} busy={busy} onClose={() => setModal(false)} onSave={save} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy}
        title="Delete asset?" message={`"${deleting?.name}" will be removed from the library.`} />
    </div>
  );
}

function AssetModal({ projects, busy, onClose, onSave }) {
  const [f, setF] = useState({ name: '', type: 'video', project_id: '', size_mb: '', tags: '', description: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title="Upload asset" size="lg"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.name.trim()} onClick={() => onSave(f)}>{busy ? 'Saving…' : 'Add to library'}</button>
        </>
      }>
      <div className="permission-note">
        <Icon name="upload" size={16} />
        <span>Demo media library — files are tracked as metadata entries (name, type, size). Uploading a real file is simulated.</span>
      </div>
      <div className="form-grid">
        <div className="field span-2"><label>File name <span className="req">*</span></label><input value={f.name} onChange={set('name')} placeholder="e.g. Hero_Cut_Final.mp4" /></div>
        <div className="field"><label>Type</label>
          <select value={f.type} onChange={set('type')}>
            {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="field"><label>Linked project</label>
          <select value={f.project_id} onChange={set('project_id')}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Size (MB)</label><input type="number" value={f.size_mb} onChange={set('size_mb')} placeholder="0" /></div>
        <div className="field"><label>Tags</label><input value={f.tags} onChange={set('tags')} placeholder="master, 4k, final" /></div>
        <div className="field span-2"><label>Description</label><textarea value={f.description} onChange={set('description')} /></div>
      </div>
    </Modal>
  );
}
