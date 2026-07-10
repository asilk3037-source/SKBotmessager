import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDb } from './testUtils.js';
import db from '../../db/index.js';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

describe('GET /api/settings', () => {
  it('returns current settings and the list of available SMS providers', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.settings.sms.provider).toBe('twilio');
    expect(res.body.smsProviders.map((p) => p.id)).toEqual(['twilio', 'mock', 'androidGateway']);
  });

  it('never returns stored secrets, only whether they are set', async () => {
    db.data.settings.sms.authToken = 'super-secret-token';
    db.data.settings.sms.password = 'android-secret';
    db.data.settings.email.appPassword = 'gmail-app-password';
    await db.write();

    const res = await request(app).get('/api/settings');
    expect(res.body.settings.sms.authToken).toBe('');
    expect(res.body.settings.sms.authTokenSet).toBe(true);
    expect(res.body.settings.sms.password).toBe('');
    expect(res.body.settings.sms.passwordSet).toBe(true);
    expect(res.body.settings.email.appPassword).toBe('');
    expect(res.body.settings.email.appPasswordSet).toBe(true);
  });
});

describe('PUT /api/settings', () => {
  it('merges partial sms settings without discarding other fields', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ sms: { provider: 'mock' } });

    expect(res.status).toBe(200);
    expect(res.body.sms.provider).toBe('mock');
    expect(res.body.sms.baseUrl).toBe('https://api.sms-gate.app/3rdparty/v1'); // untouched default kept

    expect(db.data.settings.sms.provider).toBe('mock');
    expect(db.data.auditLog).toContainEqual(
      expect.objectContaining({ action: 'settings.update', meta: { sections: ['sms'] } })
    );
  });

  it('does not write an audit entry when no recognized fields are sent', async () => {
    await request(app).put('/api/settings').send({});
    expect(db.data.auditLog).toEqual([]);
  });

  it('merges partial email settings', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ email: { user: 'me@gmail.com' } });

    expect(res.body.email.user).toBe('me@gmail.com');
    expect(res.body.email.appPassword).toBe('');
  });

  it('updates delayBetweenMessagesMs when it is a number >= 500', async () => {
    const res = await request(app).put('/api/settings').send({ delayBetweenMessagesMs: 1000 });
    expect(res.body.delayBetweenMessagesMs).toBe(1000);
  });

  it('ignores delayBetweenMessagesMs below the 500ms floor', async () => {
    const res = await request(app).put('/api/settings').send({ delayBetweenMessagesMs: 100 });
    expect(res.body.delayBetweenMessagesMs).toBe(3000); // unchanged
  });

  it('ignores a non-numeric delayBetweenMessagesMs', async () => {
    const res = await request(app).put('/api/settings').send({ delayBetweenMessagesMs: 'fast' });
    expect(res.body.delayBetweenMessagesMs).toBe(3000);
  });

  it('is a no-op when no recognized fields are sent', async () => {
    const before = JSON.stringify(db.data.settings);
    await request(app).put('/api/settings').send({});
    expect(JSON.stringify(db.data.settings)).toBe(before);
  });

  it('keeps the stored secret when a blank value is submitted', async () => {
    db.data.settings.sms.authToken = 'existing-token';
    await db.write();

    const res = await request(app)
      .put('/api/settings')
      .send({ sms: { provider: 'twilio', authToken: '' } });

    expect(res.body.sms.authTokenSet).toBe(true);
    expect(db.data.settings.sms.authToken).toBe('existing-token');
  });

  it('rejects a baseUrl with a non-http(s) protocol', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ sms: { baseUrl: 'file:///etc/passwd' } });

    expect(res.status).toBe(400);
    expect(db.data.settings.sms.baseUrl).toBe('https://api.sms-gate.app/3rdparty/v1');
  });

  it('rejects a malformed baseUrl', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ sms: { baseUrl: 'not a url' } });

    expect(res.status).toBe(400);
  });

  it('accepts an http:// baseUrl for a phone on the local network', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ sms: { baseUrl: 'http://192.168.0.10:8080' } });

    expect(res.status).toBe(200);
    expect(db.data.settings.sms.baseUrl).toBe('http://192.168.0.10:8080');
  });

  it('overwrites the stored secret when a new value is submitted', async () => {
    db.data.settings.sms.authToken = 'existing-token';
    await db.write();

    await request(app)
      .put('/api/settings')
      .send({ sms: { provider: 'twilio', authToken: 'new-token' } });

    expect(db.data.settings.sms.authToken).toBe('new-token');
  });

  it('encrypts secrets in the persisted snapshot while keeping db.data plaintext in memory', async () => {
    await request(app)
      .put('/api/settings')
      .send({ sms: { provider: 'twilio', authToken: 'plaintext-in-memory' } });

    // In-memory state used by the rest of the app (routes, SMS providers)
    // stays plaintext - only what actually gets persisted is encrypted.
    expect(db.data.settings.sms.authToken).toBe('plaintext-in-memory');

    const persisted = await db.adapter.read();
    expect(persisted.settings.sms.authToken).not.toBe('plaintext-in-memory');
    expect(persisted.settings.sms.authToken.startsWith('enc:v1:')).toBe(true);
  });

  it('saves a valid webhookUrl', async () => {
    const res = await request(app).put('/api/settings').send({ webhookUrl: 'https://example.com/hook' });
    expect(res.status).toBe(200);
    expect(res.body.webhookUrl).toBe('https://example.com/hook');
    expect(db.data.settings.webhookUrl).toBe('https://example.com/hook');
  });

  it('allows clearing the webhookUrl with an empty string', async () => {
    db.data.settings.webhookUrl = 'https://example.com/hook';
    await db.write();

    const res = await request(app).put('/api/settings').send({ webhookUrl: '' });
    expect(res.body.webhookUrl).toBe('');
    expect(db.data.settings.webhookUrl).toBe('');
  });

  it('rejects a malformed webhookUrl', async () => {
    const res = await request(app).put('/api/settings').send({ webhookUrl: 'not a url' });
    expect(res.status).toBe(400);
    expect(db.data.settings.webhookUrl).toBe('');
  });

  it('rejects a webhookUrl with a non-http(s) protocol', async () => {
    const res = await request(app).put('/api/settings').send({ webhookUrl: 'ftp://example.com/hook' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/settings/test-webhook', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a test event to the URL in the request body', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });

    const res = await request(app).post('/api/settings/test-webhook').send({ webhookUrl: 'https://example.com/hook' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://example.com/hook', expect.anything());
  });

  it('falls back to the stored webhookUrl when the request body has none', async () => {
    db.data.settings.webhookUrl = 'https://example.com/stored-hook';
    await db.write();
    fetch.mockResolvedValue({ ok: true, status: 200 });

    const res = await request(app).post('/api/settings/test-webhook').send({});

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith('https://example.com/stored-hook', expect.anything());
  });

  it('returns 400 when no URL is configured or provided', async () => {
    const res = await request(app).post('/api/settings/test-webhook').send({});
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed URL', async () => {
    const res = await request(app).post('/api/settings/test-webhook').send({ webhookUrl: 'not a url' });
    expect(res.status).toBe(400);
  });

  it('returns 502 when the endpoint cannot be reached', async () => {
    fetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app).post('/api/settings/test-webhook').send({ webhookUrl: 'https://example.com/hook' });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/não foi possível/i);
  });
});
