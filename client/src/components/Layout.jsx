import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { Icon } from './icons';
import { Avatar, ROLE_META } from './ui';

const NAV = [
  { section: 'Main', items: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', perm: 'dashboard.view' },
    { to: '/projects', label: 'Projects', icon: 'folder', perm: 'projects.view' },
    { to: '/tasks', label: 'Tasks', icon: 'kanban', perm: ['tasks.view_all', 'tasks.own'] },
    { to: '/assets', label: 'Media Assets', icon: 'film', perm: 'assets.view' },
    { to: '/calendar', label: 'Calendar', icon: 'calendar', perm: 'projects.view' },
    { to: '/estimations', label: 'Estimations', icon: 'file', perm: 'estimates.view' },
  ]},
  { section: 'People', items: [
    { to: '/employees', label: 'Employees', icon: 'users', perm: 'employees.view' },
    { to: '/timesheets', label: 'Timesheets', icon: 'clock', perm: ['timesheets.view_all', 'timesheets.submit'] },
    { to: '/attendance', label: 'Attendance', icon: 'calendarCheck', perm: 'projects.view' },
  ]},
  { section: 'Clients & Revenue', items: [
    { to: '/clients', label: 'Clients', icon: 'building', perm: 'clients.view' },
    { to: '/payroll', label: 'Payroll', icon: 'wallet', perm: 'payroll.view' },
    { to: '/invoices', label: 'Invoices', icon: 'banknote', perm: 'invoices.view' },
  ]},
  { section: 'Studio Assets', items: [
    { to: '/inventory', label: 'Equipment', icon: 'cube', perm: 'inventory.view' },
  ]},
  { section: 'Administration', items: [
    { to: '/access', label: 'Access Control', icon: 'shield', perm: 'access.view' },
    { to: '/activity', label: 'Activity Log', icon: 'activity', perm: 'activity.view' },
  ]},
];

const TITLES = {
  '/dashboard': ['Dashboard', 'Studio overview at a glance'],
  '/projects': ['Projects', 'Every production, from pitch to wrap'],
  '/tasks': ['Tasks', 'Kanban board across all productions'],
  '/assets': ['Media Assets', 'The studio media library'],
  '/employees': ['Team', 'Everyone at Lumina Studios'],
  '/timesheets': ['Timesheets', 'Hours logged across projects'],
  '/attendance': ['Attendance', 'Check-ins across the team'],
  '/clients': ['Clients', 'Accounts and their productions'],
  '/payroll': ['Payroll', 'Monthly compensation records'],
  '/invoices': ['Invoices', 'GST invoicing & payment tracking'],
  '/calendar': ['Calendar', 'Shoots, deliveries & deadlines'],
  '/estimations': ['Estimations', 'Event cost quotations'],
  '/inventory': ['Equipment', 'Cameras, hard disks & stands'],
  '/access': ['Access Control', 'Role levels and permissions'],
  '/activity': ['Activity Log', 'Every action across the studio'],
  '/profile': ['My Profile', 'Your personal details'],
  '/projects/:id': ['Project', 'Production details'],
};

export default function Layout() {
  const { user, logout, can } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const handleLogout = () => {
    logout();
    toast('Signed out', 'info');
    navigate('/login');
  };

  const { data: pending } = useApi('/timesheets?status=pending', []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); setSearchOpen(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setSidebarOpen(false); setSearchOpen(false); }, [location.pathname]);

  const permOk = (perm) => (Array.isArray(perm) ? perm.some(can) : can(perm));
  const visibleNav = NAV.map((s) => ({ ...s, items: s.items.filter((i) => permOk(i.perm)) })).filter((s) => s.items.length);

  const titleKey = Object.keys(TITLES).find((k) => {
    if (k.includes(':id')) return location.pathname.startsWith('/projects/');
    return location.pathname === k;
  }) || '/dashboard';
  const [title, sub] = TITLES[titleKey] || TITLES['/dashboard'];

  const pendingCount = pending ? pending.length : 0;
  const roleMeta = ROLE_META[user?.role] || ROLE_META.staff;

  return (
    <div className="app">
      <div className={`sidebar-scrim ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 17V7l9 5z" /></svg>
          </div>
          <div>
            <div className="sidebar__brand-name">Lumina Studios</div>
            <div className="sidebar__brand-sub">Media Production Co.</div>
          </div>
        </div>

        {visibleNav.map((section) => (
          <div key={section.section}>
            <div className="sidebar__section">{section.section}</div>
            <nav className="sidebar__nav">
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar__link ${isActive ? 'active' : ''}`}>
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                  {item.to === '/timesheets' && pendingCount > 0 && <span className="sidebar__badge">{pendingCount}</span>}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}

        <div className="sidebar__footer">
          <Avatar name={user?.name} hue={user?.avatar_hue} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div className="sidebar__footer-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div className="sidebar__footer-role">{roleMeta.label} · Level {roleMeta.level}</div>
          </div>
          <button className="sidebar__logout" onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <Icon name="menu" size={18} />
          </button>
          <div>
            <div className="topbar__title">{title}</div>
            <div className="topbar__sub">{sub}</div>
          </div>
          <div className="topbar__spacer" />

          <div className="topbar__search" ref={searchRef} style={{ position: 'relative' }}>
            <Icon name="search" size={15} />
            <input
              placeholder="Search…  (⌘K)"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
            />
            {searchOpen && search && <SearchPalette query={search} onNavigate={(to) => { navigate(to); setSearch(''); }} onClose={() => setSearchOpen(false)} />}
          </div>

          <button className="icon-btn" title="Pending timesheets" onClick={() => navigate('/timesheets')}>
            <Icon name="bell" size={17} />
            {pendingCount > 0 && <span className="dot" />}
          </button>
          <div className="flex gap-8" style={{ cursor: 'pointer' }} onClick={() => navigate('/profile')}>
            <Avatar name={user?.name} hue={user?.avatar_hue} />
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ---------- Global search palette ---------- */
function SearchPalette({ query, onNavigate, onClose }) {
  const { can } = useAuth();
  const q = query.trim().toLowerCase();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) return;
    let alive = true;
    setLoading(true);
    const jobs = [];
    if (can('projects.view')) jobs.push(api.get('/projects').then((d) => ({ type: 'Project', rows: d })));
    if (can('clients.view')) jobs.push(api.get('/clients').then((d) => ({ type: 'Client', rows: d })));
    if (can('employees.view')) jobs.push(api.get('/employees').then((d) => ({ type: 'Employee', rows: d })));
    Promise.all(jobs).then((all) => {
      if (!alive) return;
      const filtered = all
        .map((g) => ({
          type: g.type,
          rows: g.rows.filter((r) => (r.name || '').toLowerCase().includes(q)).slice(0, 4),
        }))
        .filter((g) => g.rows.length);
      setResults(filtered);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [q]);

  const goto = (type, row) => {
    if (type === 'Project') onNavigate(`/projects/${row.id}`);
    else if (type === 'Client') onNavigate('/clients');
    else if (type === 'Employee') onNavigate('/employees');
    onClose();
  };

  if (!q) return null;
  return (
    <div className="menu" style={{ left: 0, right: 0, minWidth: 340, top: 'calc(100% + 8px)' }}>
      {loading && <div className="menu__label">Searching…</div>}
      {!loading && (!results || results.length === 0) && (
        <div className="menu__label">No matches for “{q}”</div>
      )}
      {results?.map((g) => (
        <div key={g.type}>
          <div className="menu__label">{g.type}s</div>
          {g.rows.map((r) => (
            <button key={r.id} className="menu__item" onMouseDown={() => goto(g.type, r)}>
              <Icon name={g.type === 'Project' ? 'folder' : g.type === 'Client' ? 'building' : 'user'} size={15} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
