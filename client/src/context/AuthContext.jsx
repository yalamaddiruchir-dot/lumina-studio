import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, setToken, getToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (getToken()) {
      api.get('/auth/me')
        .then(setUser)
        .catch(() => { /* api client handles 401 bounce */ })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((u) => ({ ...u, ...patch }));
  }, []);

  const can = useCallback((perm) => {
    if (!user) return false;
    const map = {
      owner: 5, admin: 4, manager: 3, hr: 3, finance: 3, sales: 2, quality: 2, production: 1,
    };
    if (user.role === 'owner') return true;
    return PERM_TABLE[user.role]?.includes(perm) ?? false;
  }, [user]);

  const value = useMemo(
    () => ({ user, loading, login, logout, updateUser, can }),
    [user, loading, login, logout, updateUser, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Mirrors the server permission matrix (single source of truth: api/…/Permissions.java)
const PERM_TABLE = {
  admin: ['dashboard.view', 'employees.view', 'salary.view', 'clients.view', 'clients.manage', 'projects.view', 'projects.manage', 'projects.delete', 'pipeline.advance', 'tasks.view_all', 'tasks.manage', 'assets.view', 'assets.upload', 'assets.delete', 'timesheets.view_all', 'timesheets.submit', 'timesheets.approve', 'attendance.view_all', 'attendance.checkin', 'payroll.view', 'invoices.view', 'invoices.manage', 'activity.view', 'access.view'],
  manager: ['dashboard.view', 'employees.view', 'employees.manage', 'employees.delete', 'clients.view', 'clients.manage', 'projects.view', 'projects.manage', 'projects.delete', 'pipeline.advance', 'estimates.view', 'estimates.manage', 'inventory.view', 'tasks.view_all', 'tasks.manage', 'assets.view', 'assets.upload', 'assets.delete', 'timesheets.view_all', 'timesheets.submit', 'timesheets.approve', 'attendance.checkin', 'invoices.view', 'activity.view'],
  hr: ['dashboard.view', 'employees.view', 'employees.manage', 'employees.delete', 'salary.view', 'clients.view', 'projects.view', 'tasks.view_all', 'assets.view', 'timesheets.view_all', 'timesheets.submit', 'attendance.view_all', 'attendance.checkin', 'activity.view'],
  finance: ['dashboard.view', 'employees.view', 'salary.view', 'clients.view', 'projects.view', 'tasks.view_all', 'assets.view', 'timesheets.view_all', 'timesheets.submit', 'timesheets.approve', 'attendance.view_all', 'payroll.view', 'payroll.manage', 'invoices.view', 'invoices.manage', 'activity.view'],
  sales: ['dashboard.view', 'clients.view', 'clients.manage', 'projects.view', 'projects.manage', 'tasks.own', 'assets.view', 'timesheets.submit', 'attendance.checkin', 'invoices.view'],
  quality: ['dashboard.view', 'projects.view', 'pipeline.advance', 'tasks.own', 'assets.view', 'assets.upload', 'timesheets.submit', 'attendance.checkin'],
  production: ['dashboard.view', 'projects.view', 'tasks.own', 'assets.view', 'assets.upload', 'timesheets.submit', 'attendance.checkin'],
};
