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

  // Regression test: browsers always attach an Origin header to
  // `<script type="module">` fetches, even for same-origin requests. The
  // built index.html's script tag has `crossorigin`, so loading the app
  // directly from this server (as the packaged Electron build does, via
  // http://localhost:3001) sends `Origin: http://localhost:3001` on its own
  // JS/CSS/page requests. CORS must only apply to /api, or the app 500s on
  // its own assets the moment it isn't loaded through the Vite dev server.
  it('serves the frontend even with an Origin header that is not in the /api allowlist', async () => {
    const res = await request(app)
      .get('/alguma-rota-do-frontend')
      .set('Origin', 'http://localhost:3001');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('does not grant CORS access to an unrecognized Origin on /api routes', async () => {
    // Standard CORS semantics: the server still processes the request (a
    // real browser is what refuses to let cross-origin JS read the
    // response), it just omits the Access-Control-Allow-Origin header that
    // would let a browser's fetch() expose the response to that origin.
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('grants CORS access to /api routes when Origin matches the request\'s own host (same-origin)', async () => {
    // The SPA calling its own /api from wherever it's actually being served
    // (e.g. the packaged app hitting 127.0.0.1 on whatever port) must work
    // regardless of port, not just the hardcoded dev-server origin.
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://127.0.0.1:3001')
      .set('Host', '127.0.0.1:3001');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3001');
  });

  it('still grants CORS access to the known Vite dev server origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
