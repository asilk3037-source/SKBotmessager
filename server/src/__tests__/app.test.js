import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('createApp - static frontend fallback', () => {
  const app = createApp();

  it('serves the built index.html for a non-API route (SPA fallback)', async () => {
    const res = await request(app).get('/alguma-rota-do-frontend');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<div id="root">');
  });

  it('does not fall back to index.html for unmatched /api routes', async () => {
    const res = await request(app).get('/api/rota-que-nao-existe');
    expect(res.status).toBe(404);
  });
});
