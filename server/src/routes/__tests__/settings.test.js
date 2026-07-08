import { describe, it, expect, beforeEach } from 'vitest';
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
});
