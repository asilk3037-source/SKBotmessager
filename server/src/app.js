import express from 'express';
import cors from 'cors';
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

  app.use(cors());
  app.use(express.json({ limit: '15mb' }));

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
