/**
 * API client — fetch wrapper with auth header + error normalization.
 */
const TOKEN_KEY = 'lumina_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const { body, ...rest } = options;
  const headers = { ...(rest.headers || {}) };
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  // Never attach a (possibly stale) token to login — login must be anonymous.
  if (token && !path.startsWith('/auth/login')) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...rest, headers, body: body ? JSON.stringify(body) : undefined });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    if (res.status === 401) {
      // Session expired — clear token and bounce to login
      setToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};
