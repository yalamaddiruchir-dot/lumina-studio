/**
 * Auth middleware — JWT verification + role-based permission checks.
 */
const jwt = require('jsonwebtoken');
const { JWT_SECRET, hasPerm, ROLE_LEVELS } = require('./config');

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/** Verifies Authorization header and attaches req.user */
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = req.app.locals.db.prepare(
      'SELECT id, name, email, role, department, position, status FROM users WHERE id = ?'
    ).get(payload.id);
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    if (user.status === 'inactive') return res.status(403).json({ error: 'Account deactivated' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired — please sign in again' });
  }
}

/** Guards a route with a required capability. */
function requirePerm(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!hasPerm(req.user.role, perm)) {
      return res.status(403).json({
        error: `You need the "${perm}" permission for this action. Your role (${req.user.role}) has access level ${ROLE_LEVELS[req.user.role] || 0}.`,
      });
    }
    next();
  };
}

module.exports = { signToken, authRequired, requirePerm, hasPerm };
