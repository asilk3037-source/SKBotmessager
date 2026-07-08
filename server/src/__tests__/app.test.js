import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app.js';

// app.js serves web/dist/index.html for the SPA fallback. That's a build artifact of the
// separate "web" package, not something this test suite should depend on already existing
// (e.g. it isn't built as part of CI for the backend job) - so create a throwaway fixture
// for it here instead, and only remove what we created.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.join(__dirname, '..', '..', '..', 'web', 'dist');
const indexHtmlPath = path.join(webDist, 'index.html');
let createdDist = false;
let createdIndexHtml = false;

beforeAll(() => {
  if (!fs.existsSync(webDist)) {
    fs.mkdirSync(webDist, { recursive: true });
    createdDist = true;
  }
  if (!fs.existsSync(indexHtmlPath)) {
    fs.writeFileSync(indexHtmlPath, '<!doctype html><html><body><div id="root"></div></body></html>');
    createdIndexHtml = true;
  }
});

afterAll(() => {
  if (createdIndexHtml) fs.rmSync(indexHtmlPath, { force: true });
  if (createdDist) fs.rmSync(webDist, { recursive: true, force: true });
});

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
