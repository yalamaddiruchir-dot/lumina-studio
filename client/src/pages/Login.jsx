import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/ui';
import { Icon } from '../components/icons';

// Pre-seeded demo accounts — one per position, all sharing the sample workspace.
// Password for every account: demo123
const DEMO_ACCOUNTS = [
  // Management
  { role: 'owner', email: 'owner@lumina.studio', label: 'Owner', hue: 262 },
  { role: 'manager', email: 'manager@lumina.studio', label: 'Manager', hue: 150 },
  { role: 'manager', email: 'sanjay@lumina.studio', label: 'Project Manager', hue: 20 },
  // Administration
  { role: 'admin', email: 'admin@lumina.studio', label: 'System Administrator', hue: 210 },
  { role: 'hr', email: 'hr@lumina.studio', label: 'HR / Admin', hue: 330 },
  // Finance
  { role: 'finance', email: 'finance@lumina.studio', label: 'Accountant', hue: 200 },
  { role: 'finance', email: 'meera@lumina.studio', label: 'Billing Executive', hue: 195 },
  // Sales & Client Management
  { role: 'sales', email: 'aditya@lumina.studio', label: 'Sales Executive', hue: 180 },
  { role: 'sales', email: 'ishita@lumina.studio', label: 'Client Coordinator', hue: 155 },
  // Production Team — Data Copy
  { role: 'production', email: 'rohit@lumina.studio', label: 'Data Copy Operator', hue: 200 },
  { role: 'production', email: 'arnav@lumina.studio', label: 'Data Copy Operator', hue: 25 },
  // Production Team — Lightroom
  { role: 'production', email: 'priya@lumina.studio', label: 'Lightroom Editor', hue: 280 },
  { role: 'production', email: 'sneha@lumina.studio', label: 'Lightroom Editor', hue: 45 },
  { role: 'production', email: 'kabir@lumina.studio', label: 'Senior Lightroom Editor', hue: 250 },
  // Production Team — Video
  { role: 'production', email: 'farhan@lumina.studio', label: 'Video Editor', hue: 320 },
  { role: 'production', email: 'divya@lumina.studio', label: 'Video Editor', hue: 285 },
  { role: 'production', email: 'meera.nambiar@lumina.studio', label: 'Senior Video Editor', hue: 340 },
  // Production Team — Album
  { role: 'production', email: 'aditi@lumina.studio', label: 'Album Designer', hue: 30 },
  { role: 'production', email: 'aryan@lumina.studio', label: 'Senior Album Designer', hue: 190 },
  // Production Team — Final Review
  { role: 'quality', email: 'zoya@lumina.studio', label: 'Quality Controller', hue: 320 },
  // Camera Department
  { role: 'production', email: 'ravi@lumina.studio', label: 'Photographer', hue: 200 },
  { role: 'production', email: 'neha@lumina.studio', label: 'Videographer (Sr)', hue: 300 },
  { role: 'production', email: 'karan@lumina.studio', label: 'Videographer (Jr)', hue: 145 },
  { role: 'production', email: 'jai@lumina.studio', label: 'Drone Operator', hue: 175 },
];

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: health } = useApi('/health');
  const isDemo = health?.demo === true;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(email, password);
      toast(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const quickLogin = async (acc) => {
    setBusy(true);
    setError('');
    setMode('signin');
    setEmail(acc.email);
    setPassword('demo123');
    try {
      const user = await login(acc.email, 'demo123');
      toast(`Signed in as ${['production', 'quality', 'sales'].includes(user.role) ? user.name.split(' ')[0] : user.role}`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login__brand">
        <div className="login__brand-inner">
          <div className="login__logo">
            <div className="sidebar__logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 17V7l9 5z" /></svg>
            </div>
            Lumina Studios
          </div>
          <div className="login__headline">
            <h1>Every shoot, client and <span>paycheck</span> in one place.</h1>
            <p>
              The studio management hub for weddings, events and production —
              with role-based access so everyone sees exactly what they need.
            </p>
            <div className="login__proof">
              <div><b>8</b><span>access levels</span></div>
              <div><b>5</b><span>departments</span></div>
              <div><b>7</b><span>pipeline stages</span></div>
              <div><b>24</b><span>team members</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="login__panel">
        <div className="login__card">
          <h2>Welcome back</h2>
          <p>Sign in to your studio workspace.</p>
          <span className="muted" style={{ fontSize: 11 }}>Lumina Studios v2.6.1</span>

          {error && <div className="login__error">{error}</div>}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input id="email" type="email" placeholder="you@company.com" value={email}
                onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            <button className="btn btn--primary btn--block" type="submit" disabled={busy} style={{ marginTop: 4 }}>
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && <Icon name="arrowRight" size={16} />}
            </button>
          </form>

          {isDemo ? (
          <div className="demo-box">
            <span>Demo accounts — every position (password: demo123)</span>
            <div className="demo-accounts">
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.email} className="demo-account" onClick={() => quickLogin(a)} disabled={busy}>
                  <Avatar name={a.label} hue={a.hue} size="sm" />
                  {a.label}
                </button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-3)' }}>
              All demo accounts share the password <span className="kbd">demo123</span>
            </p>
          </div>
          ) : (
          <div className="demo-box">
            <span>Studio account</span>
            <p className="hint" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
              This workspace has no demo accounts. Sign in with the login your studio
              (Owner / Manager / HR) created for you.
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
