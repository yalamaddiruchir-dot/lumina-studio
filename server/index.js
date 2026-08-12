/**
 * Lumina Studios API server.
 */
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const {
  PORT, NODE_ENV, CORS_ORIGINS, SEED_DEMO,
} = require('./config');
const { db, isFresh, logActivity } = require('./db');

const app = express();
app.locals.db = db;
app.disable('x-powered-by');

// Behind a reverse proxy (Caddy/Nginx/LB), so rate limiters see the real client IP.
app.set('trust proxy', 1);

// ---- Demo seeding ----
// Fresh DB + SEED_DEMO=true (development default) → seed demo accounts.
// In production (SEED_DEMO=false) a fresh DB stays empty; create real accounts via:
//   npm run create:admin -- --email owner@company.com --password '...'
if (isFresh()) {
  if (SEED_DEMO) {
    require('./seed');
  } else {
    console.warn('[boot] Fresh database with SEED_DEMO=false — no accounts exist yet.');
    console.warn('[boot] Create the first account with: npm run create:admin -- --email you@company.com');
  }
}

// ---- Security headers (production only — helmet's CSP would break the Vite dev server) ----
if (NODE_ENV === 'production') {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // React inline style props
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"], // blocks clickjacking / being embedded elsewhere
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    })
  );
}

// ---- CORS ----
// Development: any origin (Vite dev server on :5173 → API on :3001).
// Production: same-origin by default (frontend served by this process);
//             restrict further with CORS_ORIGINS=https://app.company.com if needed.
if (NODE_ENV === 'production') {
  app.use(cors({ origin: CORS_ORIGINS.length ? CORS_ORIGINS : false, credentials: true }));
} else {
  app.use(cors({ origin: true, credentials: true }));
}

app.use(express.json({ limit: '2mb' }));

// ---- Rate limiting (enforced in production; skipped in dev for a smooth DX) ----
const isProd = () => NODE_ENV === 'production';
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600, // 600 requests / 15 min / IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => !isProd(),
  message: { error: 'Too many requests — slow down and try again later.' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20, // 20 login attempts / 15 min / IP — brute-force protection
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => !isProd(),
  message: { error: 'Too many login attempts — try again in 15 minutes.' },
});
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);

// Tiny request logger
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'Lumina Studios', env: NODE_ENV, time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth').router);
app.use('/api/employees', require('./routes/employees'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/timesheets', require('./routes/timesheets'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/activity', require('./routes/activity'));

// 404 for unknown API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ---- Production: serve the built frontend + SPA fallback ----
if (NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'client', 'dist');
  app.use(
    express.static(dist, {
      maxAge: '1d',
      setHeaders(res, filePath) {
        // Hashed build assets are immutable — cache hard for a year.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    })
  );
  // SPA fallback: any non-API GET serves the app shell (client-side routing).
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(dist, 'index.html'));
    }
    next();
  });
}

// ---- Error handling ----
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Lumina Studios API listening on http://0.0.0.0:${PORT} (${NODE_ENV})`);
});

module.exports = { app, db, logActivity };
