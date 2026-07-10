import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import contactsRouter from './routes/contacts.js';
import templatesRouter from './routes/templates.js';
import campaignsRouter from './routes/campaigns.js';
import reportsRouter from './routes/reports.js';
import settingsRouter from './routes/settings.js';
import whatsappRouter from './routes/whatsapp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // CSP is left off: this app is loaded from a local Electron/dev-server
  // origin, not served publicly, and the default directives would fight
  // things like the base64 WhatsApp QR code image and inline styles.
  app.use(helmet({ contentSecurityPolicy: false }));

  const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
  // Scoped to /api only: this server also serves the built SPA itself
  // (below), and browsers always attach an Origin header to
  // `<script type="module">` fetches even for same-origin requests - a
  // global CORS check here would 500 the app's own JS/CSS when it's loaded
  // directly from this server (e.g. the packaged Electron build hitting
  // http://127.0.0.1:3001), since that origin was never meant to need one.
  app.use('/api', cors((req, callback) => {
    const origin = req.header('Origin');
    // No Origin header (curl, server-to-server calls) is always allowed.
    // A same-origin request is always allowed too - browsers attach Origin
    // to same-origin POST/PUT/DELETE fetches as well, and this server's own
    // SPA (served from whatever host:port it's actually running on, not
    // necessarily 3001) making its own /api calls is exactly that case, not
    // a cross-origin one. Only genuinely cross-origin requests are
    // restricted to the known dev server.
    let sameOrigin = false;
    if (origin) {
      try {
        sameOrigin = new URL(origin).host === req.get('host');
      } catch {
        sameOrigin = false;
      }
    }
    const allowed = !origin || sameOrigin || allowedOrigins.has(origin);
    callback(null, { origin: allowed });
  }));
  app.use(express.json({ limit: '15mb' }));
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  app.use('/api/contacts', contactsRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/whatsapp', whatsappRouter);

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // Serve the built frontend in production (npm run build inside /web outputs to /web/dist)
  const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(webDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  });

  return app;
}
