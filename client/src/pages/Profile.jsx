import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Avatar, Badge, PageHeader, ROLE_META, Skeleton } from '../components/ui';
import { formatDate, todayISO } from '../lib/format';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const { data: my } = useApi('/auth/me');

  const me = my || user;
  const [form, setForm] = useState(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);

  const roleMeta = ROLE_META[me?.role] || ROLE_META.staff;

  const saveProfile = async () => {
    setBusy(true);
    try {
      const updated = await api.put(`/employees/${me.id}`, form);
      updateUser({ bio: updated.bio, phone: updated.phone, location: updated.location, skills: updated.skills, position: updated.position, department: updated.department });
      setForm(null);
      toast('Profile updated');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/change-password', pw);
      setPw({ current: '', next: '' });
      toast('Password changed');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!me) return <div className="card" style={{ padding: 20 }}><Skeleton style={{ height: 300 }} /></div>;

  return (
    <div>
      <PageHeader title="My profile" sub="Personal details and account settings" />

      <div className="profile-banner mb-16" />

      <div className="grid-2" style={{ gridTemplateColumns: '340px 1fr', alignItems: 'start' }}>
        <div className="card" style={{ marginTop: -56, position: 'relative', zIndex: 1 }}>
          <div className="card__body" style={{ textAlign: 'center', paddingTop: 26 }}>
            <Avatar name={me.name} hue={me.avatar_hue} size="xl" />
            <h2 style={{ marginTop: 14, fontSize: 18, fontWeight: 800 }}>{me.name}</h2>
            <div className="flex gap-8 mt-8" style={{ justifyContent: 'center' }}>
              <Badge role={me.role} />
              <Badge status={me.status} />
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>{me.email}</p>
            <p className="text-2" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>{me.bio || 'No bio yet.'}</p>
            {me.skills && (
              <div className="asset-card__tags" style={{ justifyContent: 'center', marginTop: 14 }}>
                {me.skills.split(',').map((s) => <span key={s} className="asset-tag">{s.trim()}</span>)}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card__head">
              <div>
                <div className="card__title">About & contact</div>
                <div className="card__hint">Access level {roleMeta.level} · {roleMeta.label}</div>
              </div>
              <button className="btn btn--secondary btn--sm" onClick={() => setForm({ bio: me.bio, phone: me.phone, location: me.location, skills: me.skills, position: me.position, department: me.department })}>
                <Icon name="pencil" size={14} /> Edit
              </button>
            </div>
            <div className="card__body">
              {form ? (
                <div className="form-grid">
                  <div className="field"><label>Position</label><input value={form.position || ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
                  <div className="field"><label>Department</label><input value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
                  <div className="field"><label>Phone</label><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="field"><label>Location</label><input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                  <div className="field span-2"><label>Skills</label><input value={form.skills || ''} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></div>
                  <div className="field span-2"><label>Bio</label><textarea value={form.bio || ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
                  <div className="span-2 flex" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn--secondary btn--sm" onClick={() => setForm(null)}>Cancel</button>
                    <button className="btn btn--primary btn--sm" disabled={busy} onClick={saveProfile}>{busy ? 'Saving…' : 'Save profile'}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="kv"><span>Email</span><span>{me.email}</span></div>
                  <div className="kv"><span>Phone</span><span>{me.phone || '—'}</span></div>
                  <div className="kv"><span>Joined</span><span>{formatDate(me.hire_date)}</span></div>
                  <div className="kv"><span>Today</span><span>{formatDate(todayISO())}</span></div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <div>
                <div className="card__title">Change password</div>
                <div className="card__hint">Must be at least 6 characters</div>
              </div>
            </div>
            <div className="card__body">
              <form onSubmit={changePassword} className="form-grid">
                <div className="field"><label>Current password</label><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
                <div className="field"><label>New password</label><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
                <div className="span-2 flex" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn--primary btn--sm" disabled={busy || !pw.current || pw.next.length < 6}>Update password</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
