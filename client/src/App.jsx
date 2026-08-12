import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Icon } from './components/icons';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Tasks from './pages/Tasks';
import Assets from './pages/Assets';
import Clients from './pages/Clients';
import Employees from './pages/Employees';
import Timesheets from './pages/Timesheets';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Invoices from './pages/Invoices';
import Calendar from './pages/Calendar';
import AccessControl from './pages/AccessControl';
import ActivityLog from './pages/ActivityLog';
import Profile from './pages/Profile';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequirePerm({ perm, children }) {
  const { user, can } = useAuth();
  if (can(perm)) return children;
  if (user?.role === 'staff' && perm === 'tasks.view_all') {
    // staff see their own tasks
    return children;
  }
  return (
    <div className="card" style={{ maxWidth: 560, margin: '60px auto' }}>
      <div className="card__body" style={{ textAlign: 'center', padding: '44px 30px' }}>
        <div className="empty__art" style={{ color: '#c3c8e0', margin: '0 auto 14px' }}>
          <Icon name="lock" size={60} strokeWidth={1.4} />
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 800 }}>Restricted area</h3>
        <p style={{ marginTop: 8, fontSize: 13.5, color: 'var(--text-2)' }}>
          Your role ({user?.role}) doesn't have the <b>{perm}</b> permission.
          Contact an admin to request a higher access level.
        </p>
      </div>
    </div>
  );
}

function FullLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="sidebar__logo" style={{ margin: '0 auto 16px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 17V7l9 5z" /></svg>
        </div>
        <div className="skeleton" style={{ width: 220, height: 14, margin: '0 auto' }} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<RequirePerm perm="dashboard.view"><Dashboard /></RequirePerm>} />
        <Route path="/projects" element={<RequirePerm perm="projects.view"><Projects /></RequirePerm>} />
        <Route path="/projects/:id" element={<RequirePerm perm="projects.view"><ProjectDetail /></RequirePerm>} />
        <Route path="/tasks" element={<RequirePerm perm="tasks.view_all"><Tasks /></RequirePerm>} />
        <Route path="/assets" element={<RequirePerm perm="assets.view"><Assets /></RequirePerm>} />
        <Route path="/clients" element={<RequirePerm perm="clients.view"><Clients /></RequirePerm>} />
        <Route path="/employees" element={<RequirePerm perm="employees.view"><Employees /></RequirePerm>} />
        <Route path="/timesheets" element={<RequirePerm perm="timesheets.submit"><Timesheets /></RequirePerm>} />
        <Route path="/attendance" element={<RequirePerm perm="attendance.checkin"><Attendance /></RequirePerm>} />
        <Route path="/payroll" element={<RequirePerm perm="payroll.view"><Payroll /></RequirePerm>} />
        <Route path="/invoices" element={<RequirePerm perm="invoices.view"><Invoices /></RequirePerm>} />
        <Route path="/calendar" element={<RequirePerm perm="projects.view"><Calendar /></RequirePerm>} />
        <Route path="/access" element={<RequirePerm perm="access.view"><AccessControl /></RequirePerm>} />
        <Route path="/activity" element={<RequirePerm perm="activity.view"><ActivityLog /></RequirePerm>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
