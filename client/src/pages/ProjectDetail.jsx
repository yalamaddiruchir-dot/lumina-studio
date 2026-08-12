import { useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Avatar, Badge, Modal, ConfirmDialog, Skeleton, EmptyState, PIPELINE } from '../components/ui';
import { money, moneyCompact, formatDate } from '../lib/format';

const TYPE_ICONS = { wedding: 'heart', pre_wedding: 'camera', event: 'calendar', corporate: 'briefcase', portfolio: 'image' };

export default function ProjectDetail() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data, loading, setData } = useApi(`/projects/${id}`);
  const [taskModal, setTaskModal] = useState(false);
  const [moving, setMoving] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [busy, setBusy] = useState(false);
  // Photo gallery
  const { data: photos, loading: photosLoading, setData: setPhotos } = useApi(`/projects/${id}/photos`);
  const [photoFilter, setPhotoFilter] = useState('all');
  const [photoModal, setPhotoModal] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const filteredPhotos = useMemo(() => (photos || []).filter((ph) =>
    photoFilter === 'all' || ph.status === photoFilter), [photos, photoFilter]);

  if (loading) return <div className="card" style={{ padding: 20 }}><Skeleton style={{ height: 340 }} /></div>;
  if (!data) return <div className="card"><p className="muted" style={{ padding: 30, textAlign: 'center' }}>Project not found.</p></div>;

  const p = data;
  const pct = Math.min(p.progress, 100);

  const moveTask = async (task, status) => {
    setMoving(task.id);
    const prev = task.status;
    // optimistic
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, status } : t)) }));
    try {
      await api.patch(`/tasks/${task.id}/status`, { status });
      toast(`Task moved to ${status.replace('_', ' ')}`);
    } catch (e) {
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, status: prev } : t)) }));
      toast(e.message, 'error');
    } finally {
      setMoving(null);
    }
  };

  const addTask = async (form) => {
    setBusy(true);
    try {
      const created = await api.post('/tasks', { ...form, project_id: p.id });
      setData((d) => ({ ...d, tasks: [created, ...d.tasks] }));
      toast('Task added');
      setTaskModal(false);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeTask = async () => {
    setBusy(true);
    try {
      await api.del(`/tasks/${deleteTask.id}`);
      setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== deleteTask.id) }));
      toast('Task removed');
      setDeleteTask(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const canManageTasks = can('tasks.manage');
  const canMove = (t) => (canManageTasks || (can('tasks.own') && t.assignee_id === user?.id));

  const canSelectPhoto = () => can('clients.manage') || can('pipeline.advance') || can('assets.upload');
  const canApprovePhoto = () => can('pipeline.advance');

  const movePhoto = async (photo, status) => {
    const prev = photo.status;
    setPhotos((d) => d.map((ph) => (ph.id === photo.id ? { ...ph, status } : ph))); // optimistic
    try {
      const updated = await api.patch(`/photos/${photo.id}`, { status });
      setPhotos((d) => d.map((ph) => (ph.id === photo.id ? updated : ph)));
      toast(status === 'approved' ? 'Photo approved for the album' : 'Photo marked as client selection');
    } catch (e) {
      setPhotos((d) => d.map((ph) => (ph.id === photo.id ? { ...ph, status: prev } : ph)));
      toast(e.message, 'error');
    }
  };

  const deletePhoto = async (photo) => {
    setPhotoBusy(true);
    try {
      await api.del(`/photos/${photo.id}`);
      setPhotos((d) => d.filter((ph) => ph.id !== photo.id));
      toast('Photo removed from gallery');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const uploadPhoto = async (form) => {
    setPhotoBusy(true);
    try {
      const created = await api.post(`/projects/${p.id}/photos`, form);
      setPhotos((d) => [created, ...(d || [])]);
      toast('Photo added to gallery');
      setPhotoModal(false);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const advanceStage = async () => {
    const next = PIPELINE[PIPELINE.indexOf(p.status) + 1];
    if (!next) return;
    setBusy(true);
    try {
      const updated = await api.patch(`/projects/${p.id}/stage`, { status: next });
      setData((d) => ({ ...d, ...updated }));
      toast(`Advanced to ${next.replace('_', ' ')}`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/projects" className="back-link"><Icon name="chevronLeft" size={15} /> All projects</Link>

      <div className="detail-hero mb-16">
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name={TYPE_ICONS[p.type] || 'folder'} size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
            <h1>{p.name}</h1>
            <Badge status={p.status} />
            <Badge priority={p.priority} />
          </div>
          <div className="detail-meta">
            <span><b>{p.client_name || 'Internal project'}</b>{p.client_company ? ` · ${p.client_company}` : ''}</span>
            <span><Icon name="user" size={13} /> Manager: {p.manager_name || 'Unassigned'}</span>
            {p.shoot_date && <span><Icon name="camera" size={13} /> Shoot: <b>{formatDate(p.shoot_date)}</b></span>}
            <span><Icon name="calendar" size={13} /> {formatDate(p.start_date)} → {formatDate(p.deadline)}</span>
            <span><Icon name="wallet" size={13} /> <b className="mono">{moneyCompact(p.spent)}</b> / {moneyCompact(p.budget)}</span>
          </div>
        </div>
        {can('projects.manage') && (
          <button className="btn btn--secondary" onClick={() => navigate('/projects')}><Icon name="pencil" size={15} /> Edit in list</button>
        )}
      </div>

      <PipelineStepper current={p.status} canAdvance={can('pipeline.advance')} onAdvance={advanceStage} busy={busy} />

      {/* Client photo gallery & album approval */}
      <div className="card mb-16">
        <div className="card__head">
          <div>
            <div className="card__title">Photo gallery</div>
            <div className="card__hint">
              Client selects favourites → QC approves → frames go into the album
            </div>
          </div>
          <div className="flex gap-8">
            {can('assets.upload') && (
              <button className="btn btn--secondary btn--sm" onClick={() => setPhotoModal(true)}>
                <Icon name="upload" size={14} /> Add photo
              </button>
            )}
          </div>
        </div>
        <div className="card__body" style={{ paddingTop: 14 }}>
          {!photosLoading && (photos?.length || 0) > 0 && (
            <div className="flex gap-8 mb-12" style={{ flexWrap: 'wrap' }}>
              <div className="segmented">
                {['all', 'uploaded', 'selected', 'approved'].map((s) => (
                  <button key={s} className={photoFilter === s ? 'active' : ''} onClick={() => setPhotoFilter(s)}>
                    {s === 'all' ? `All (${photos.length})` : s === 'uploaded' ? `Uploaded (${photos.filter((x) => x.status === 'uploaded').length})` : s === 'selected' ? `Selected (${photos.filter((x) => x.status === 'selected').length})` : `Approved (${photos.filter((x) => x.status === 'approved').length})`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {photosLoading ? (
            <div className="asset-grid">
              {[...Array(6)].map((_, i) => <div key={i} className="card"><Skeleton style={{ height: 150 }} /></div>)}
            </div>
          ) : filteredPhotos.length === 0 ? (
            <EmptyState small icon="image" title={photoFilter === 'all' ? 'No photos yet' : `No ${photoFilter} photos`}
              message={photoFilter === 'all' ? 'Upload culled photos here — the client picks favourites and QC approves them for the album.' : 'No photos in this status.'}
              action={can('assets.upload') && <button className="btn btn--primary btn--sm" onClick={() => setPhotoModal(true)}><Icon name="upload" size={14} /> Add photo</button>} />
          ) : (
            <div className="asset-grid">
              {filteredPhotos.map((ph) => (
                <div key={ph.id} className="asset-card" style={{ cursor: 'default' }}>
                  <div className="asset-card__thumb" style={{ ['--thumb-hue']: `hsl(${ph.hue || 210} 32% 90%)`, height: 130 }}>
                    <Icon name="image" size={42} style={{ color: 'var(--primary)' }} strokeWidth={1.5} />
                    <span className="asset-card__type">{ph.category || 'Photo'}</span>
                    {ph.status === 'approved' && (
                      <span style={{ position: 'absolute', right: 9, top: 9, color: 'var(--success)' }}><Icon name="checkCircle" size={20} /></span>
                    )}
                  </div>
                  <div className="asset-card__body">
                    <div className="asset-card__name" title={ph.name}>{ph.name}</div>
                    <div className="asset-card__meta">
                      <span>{ph.size_mb} MB{ph.captured_on ? ` · ${formatDate(ph.captured_on)}` : ''}</span>
                      <span>{ph.uploader_name || '—'}</span>
                    </div>
                    <div className="flex-between mt-8" style={{ gap: 6 }}>
                      <Badge status={ph.status} />
                      <div className="flex gap-6">
                        {ph.status !== 'approved' && canSelectPhoto() && (
                          <button className="btn btn--xs btn--secondary" title={ph.status === 'selected' ? 'Revert selection' : 'Mark as client selection'}
                            onClick={() => movePhoto(ph, ph.status === 'selected' ? 'uploaded' : 'selected')}>
                            {ph.status === 'selected' ? 'Revert' : 'Select'}
                          </button>
                        )}
                        {ph.status === 'selected' && canApprovePhoto() && (
                          <button className="btn btn--xs btn--primary" onClick={() => movePhoto(ph, 'approved')} title="Approve for album">
                            <Icon name="check" size={12} /> Approve
                          </button>
                        )}
                        {(can('assets.delete') || ph.uploaded_by === user?.id) && (
                          <button className="icon-btn" style={{ width: 24, height: 24, color: 'var(--text-3)' }} title="Delete"
                            onClick={() => deletePhoto(ph)}>
                            <Icon name="trash" size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {p.description && (
        <div className="card mb-16">
          <div className="card__body"><p className="text-2" style={{ fontSize: 13.5, lineHeight: 1.65 }}>{p.description}</p></div>
        </div>
      )}

      <div className="grid-2 mb-16" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">Tasks <span className="muted" style={{ fontWeight: 600 }}>({p.tasks.length})</span></div>
              <div className="card__hint">{p.done_tasks} of {p.task_count} completed</div>
            </div>
            {can('tasks.manage') && <button className="btn btn--primary btn--sm" onClick={() => setTaskModal(true)}><Icon name="plus" size={14} /> Add task</button>}
          </div>
          <div className="card__body" style={{ paddingTop: 8 }}>
            {p.tasks.length === 0 && <p className="muted" style={{ padding: '18px 0', textAlign: 'center' }}>No tasks yet for this project.</p>}
            {p.tasks.map((t) => (
              <div key={t.id} className="flex-between" style={{ padding: '11px 0', borderBottom: '1px solid var(--border)', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? 'var(--text-3)' : 'var(--text)' }}>{t.title}</span>
                    <Badge priority={t.priority} className="badge--dotless" />
                  </div>
                  <div className="flex gap-8 mt-8" style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
                    {t.assignee_name && <span className="flex gap-6"><Avatar name={t.assignee_name} hue={t.assignee_hue} size="sm" />{t.assignee_name}</span>}
                    {t.due_date && <span>· Due {formatDate(t.due_date)}</span>}
                  </div>
                </div>
                <div className="flex gap-6">
                  <Badge status={t.status} />
                  {canMove(t) && (
                    <select
                      value={t.status}
                      onChange={(e) => moveTask(t, e.target.value)}
                      disabled={moving === t.id}
                      style={{ font: 'inherit', fontSize: 12, padding: '4px 6px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', outline: 'none' }}
                    >
                      {['todo', 'in_progress', 'review', 'done'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  )}
                  {can('tasks.manage') && (
                    <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setDeleteTask(t)}><Icon name="trash" size={13} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card mb-16">
            <div className="card__head">
              <div>
                <div className="card__title">Budget</div>
                <div className="card__hint">Utilization of {money(p.budget)}</div>
              </div>
              <span style={{ fontWeight: 800, fontSize: 18 }} className="mono">{pct}%</span>
            </div>
            <div className="card__body">
              <div className="progress mb-12"><div style={{ width: `${pct}%` }} /></div>
              <div className="kv"><span>Budget</span><span className="mono">{money(p.budget)}</span></div>
              <div className="kv"><span>Spent</span><span className="mono" style={{ color: 'var(--primary)' }}>{money(p.spent)}</span></div>
              <div className="kv"><span>Remaining</span><span className="mono" style={{ color: 'var(--success)' }}>{money(Math.max(p.budget - p.spent, 0))}</span></div>
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <div>
                <div className="card__title">Team ({p.team.length})</div>
                <div className="card__hint">People with tasks on this project</div>
              </div>
            </div>
            <div className="card__body" style={{ paddingTop: 10 }}>
              {p.team.map((m) => (
                <div key={m.id} className="flex" style={{ gap: 10, padding: '8px 0' }}>
                  <Avatar name={m.name} hue={m.avatar_hue} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{m.position || m.department}</div>
                  </div>
                </div>
              ))}
              {p.team.length === 0 && <p className="muted" style={{ padding: '12px 0' }}>No team members yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <div className="card__title">Assets ({p.assets.length})</div>
            <div className="card__hint">Files linked to this production</div>
          </div>
          <Link to="/assets" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>Open library</Link>
        </div>
        <div className="card__body">
          {p.assets.length === 0 && <p className="muted" style={{ padding: '12px 0', textAlign: 'center' }}>No assets linked yet.</p>}
          <div className="asset-grid">
            {p.assets.slice(0, 6).map((a) => (
              <div key={a.id} className="asset-card" style={{ cursor: 'default' }}>
                <div className="asset-card__thumb" style={{ height: 76, ['--thumb-hue']: `hsl(${a.hue} 30% 90%)` }}>
                  <Icon name={a.type === 'video' ? 'play' : a.type === 'image' ? 'image' : a.type === 'audio' ? 'music' : a.type === 'design' ? 'palette' : a.type === '3d' ? 'cube' : 'file'} size={26} />
                </div>
                <div className="asset-card__body" style={{ padding: '10px 12px' }}>
                  <div className="asset-card__name" style={{ fontSize: 12.5 }}>{a.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {taskModal && <AddTaskModal projectId={p.id} onClose={() => setTaskModal(false)} onSave={addTask} busy={busy} />}
      <ConfirmDialog open={!!deleteTask} onClose={() => setDeleteTask(null)} onConfirm={removeTask} busy={busy}
        title="Delete task?" message={`"${deleteTask?.title}" will be permanently removed.`} />
      {photoModal && <PhotoModal busy={photoBusy} onClose={() => setPhotoModal(false)} onSave={uploadPhoto} />}
    </div>
  );
}


function PhotoModal({ busy, onClose, onSave }) {
  const [f, setF] = useState({ name: '', category: 'Ceremony', size_mb: '', captured_on: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title="Add photo to gallery" size="sm"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.name.trim()} onClick={() => onSave(f)}>
            {busy ? 'Saving…' : 'Add photo'}
          </button>
        </>
      }>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="field"><label>File name <span className="req">*</span></label><input value={f.name} onChange={set('name')} placeholder="e.g. Ceremony_023.jpg" /></div>
        <div className="field"><label>Category / segment</label>
          <select value={f.category} onChange={set('category')}>
            {['Ceremony', 'Pre-Wedding', 'Portraits', 'Reception', 'Family', 'Couple', 'Engagement', 'Corporate', 'Destination', 'Celebration'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field"><label>Captured on</label><input type="date" value={f.captured_on} onChange={set('captured_on')} /></div>
        <div className="field"><label>Size (MB)</label><input type="number" value={f.size_mb} onChange={set('size_mb')} placeholder="0" /></div>
      </div>
    </Modal>
  );
}

/* Production workflow stepper: Booked → Data Copy → Lightroom → Video → Album → Final Review → Delivered */
function PipelineStepper({ current, canAdvance, onAdvance, busy }) {
  const idx = PIPELINE.indexOf(current);
  const isTerminal = current === 'delivered' || current === 'cancelled';
  const next = idx >= 0 && idx < PIPELINE.length - 1 ? PIPELINE[idx + 1] : null;
  const stepMeta = {
    booked: { icon: 'calendar', label: 'Booked', sub: 'Booking & contract' },
    data_copy: { icon: 'download', label: 'Data Copy', sub: 'Ingest & backup' },
    lightroom: { icon: 'image', label: 'Lightroom', sub: 'Cull & grade' },
    video: { icon: 'film', label: 'Video', sub: 'Edit & mix' },
    album: { icon: 'palette', label: 'Album', sub: 'Layout & design' },
    final_review: { icon: 'eye', label: 'Final Review', sub: 'QC sign-off' },
    delivered: { icon: 'checkCircle', label: 'Delivered', sub: 'Handed to client' },
  };
  return (
    <div className="card mb-16">
      <div className="card__body" style={{ padding: '16px 18px 18px' }}>
        <div className="flex-between mb-12">
          <div>
            <div className="card__title" style={{ fontSize: 13.5 }}>Production workflow</div>
            <div className="card__hint">
              {isTerminal
                ? current === 'delivered' ? 'Delivered — this order is complete 🎉' : 'This order was cancelled.'
                : `Current stage: ${stepMeta[current]?.label || current} → next: ${next ? stepMeta[next].label : '—'}`}
            </div>
          </div>
          {next && canAdvance && (
            <button className="btn btn--primary btn--sm" onClick={onAdvance} disabled={busy}>
              <Icon name="arrowRight" size={14} /> Advance to {stepMeta[next].label}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, flexWrap: 'wrap' }}>
          {PIPELINE.map((s, i) => {
            const meta = stepMeta[s];
            const done = idx > i || current === 'delivered';
            const active = i === idx && !isTerminal;
            const color = active ? 'var(--primary)' : done ? 'var(--success)' : 'var(--border-strong)';
            const bg = active ? 'var(--primary-soft)' : done ? 'var(--success-soft)' : 'var(--surface-2)';
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 120 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, color, display: 'grid', placeItems: 'center', boxShadow: active ? '0 6px 14px -6px rgba(99,102,241,.5)' : 'none' }}>
                    <Icon name={meta.icon} size={18} />
                  </div>
                  <div style={{ marginTop: 7, fontSize: 12, fontWeight: 700, color: active || done ? 'var(--text)' : 'var(--text-3)', textAlign: 'center' }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', textAlign: 'center', fontWeight: 500 }}>{meta.sub}</div>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div style={{ flex: 1, height: 2, marginTop: 19, background: i < idx ? 'var(--success)' : 'var(--border)', minWidth: 12 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AddTaskModal({ projectId, onClose, onSave, busy }) {
  const { user } = useAuth();
  const { data: employees } = useApi('/employees');
  const [f, setF] = useState({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '', estimated_hours: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title="Add task" size="lg"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy || !f.title.trim()} onClick={() => onSave(f)}>{busy ? 'Saving…' : 'Add task'}</button>
        </>
      }>
      <div className="form-grid">
        <div className="field span-2"><label>Title <span className="req">*</span></label><input value={f.title} onChange={set('title')} placeholder="What needs to be done?" /></div>
        <div className="field"><label>Assignee</label>
          <select value={f.assignee_id} onChange={set('assignee_id')}>
            <option value="">Unassigned</option>
            {(employees || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Priority</label>
          <select value={f.priority} onChange={set('priority')}>
            {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field"><label>Due date</label><input type="date" value={f.due_date} onChange={set('due_date')} /></div>
        <div className="field"><label>Estimated hours</label><input type="number" value={f.estimated_hours} onChange={set('estimated_hours')} placeholder="0" /></div>
        <div className="field span-2"><label>Description</label><textarea value={f.description} onChange={set('description')} /></div>
      </div>
    </Modal>
  );
}
