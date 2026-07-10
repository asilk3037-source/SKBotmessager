import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const sendSmsMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/smsService.js', () => ({ sendSms: (...args) => sendSmsMock(...args) }));
vi.mock('../../services/whatsappService.js', () => ({ default: { sendMessage: vi.fn() } }));
vi.mock('../../services/emailService.js', () => ({ sendEmail: vi.fn() }));

const { createApp } = await import('../../app.js');
const { resetDb } = await import('./testUtils.js');
const db = (await import('../../db/index.js')).default;

const app = createApp();

beforeEach(async () => {
  await resetDb();
  sendSmsMock.mockClear();
  sendSmsMock.mockResolvedValue(undefined);
});

function addContactAndTemplate() {
  db.data.contacts.push({ id: 'c1', batchId: 'b1', name: 'Joao', phone: '11988887777', email: '', extras: {} });
  db.data.templates.push({
    id: 't1',
    name: 'T',
    content: 'Ola {{nome}}',
    subject: '',
    channel: 'sms',
    createdAt: new Date().toISOString()
  });
}

describe('POST /api/campaigns', () => {
  it('validates required fields', async () => {
    const res = await request(app).post('/api/campaigns').send({ name: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obrigatórios/i);
  });

  it('rejects an invalid channel', async () => {
    addContactAndTemplate();
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'X', templateId: 't1', channel: 'fax', contactIds: ['c1'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/whatsapp.*sms.*email/i);
  });

  it('returns 404 when the template does not exist', async () => {
    db.data.contacts.push({ id: 'c1', batchId: 'b1', name: 'Joao', phone: '111', email: '', extras: {} });
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'X', templateId: 'missing', channel: 'sms', contactIds: ['c1'] });
    expect(res.status).toBe(404);
  });

  it('creates and starts a campaign, returning it in "running" state', async () => {
    addContactAndTemplate();
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Disparo', templateId: 't1', channel: 'sms', contactIds: ['c1'] });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('running');
    expect(res.body.totalCount).toBe(1);
    expect(db.data.campaigns).toHaveLength(1);
  });

  it('creates a "scheduled" campaign instead of running it immediately when scheduledAt is a future date', async () => {
    addContactAndTemplate();
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Disparo agendado', templateId: 't1', channel: 'sms', contactIds: ['c1'], scheduledAt });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('scheduled');
    expect(res.body.scheduledAt).toBe(scheduledAt);
    expect(res.body.processedCount).toBe(0);
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it('rejects a scheduledAt in the past', async () => {
    addContactAndTemplate();
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'X', templateId: 't1', channel: 'sms', contactIds: ['c1'], scheduledAt: '2020-01-01T00:00:00.000Z' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/futuro/i);
  });

  it('rejects an unparsable scheduledAt', async () => {
    addContactAndTemplate();
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'X', templateId: 't1', channel: 'sms', contactIds: ['c1'], scheduledAt: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválida/i);
  });
});

describe('POST /api/campaigns/:id/cancel', () => {
  it('cancels a scheduled campaign', async () => {
    db.data.campaigns.push({
      id: 'sched-1',
      name: 'X',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString()
    });

    const res = await request(app).post('/api/campaigns/sched-1/cancel');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(db.data.campaigns.find((c) => c.id === 'sched-1').status).toBe('cancelled');
  });

  it('returns 400 when the campaign is not in "scheduled" state', async () => {
    db.data.campaigns.push({ id: 'run-1', name: 'X', status: 'running', createdAt: new Date().toISOString() });

    const res = await request(app).post('/api/campaigns/run-1/cancel');

    expect(res.status).toBe(400);
  });

  it('returns 404 for a campaign that does not exist', async () => {
    const res = await request(app).post('/api/campaigns/missing/cancel');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/campaigns and /api/campaigns/:id', () => {
  it('lists campaigns sorted by most recent first', async () => {
    db.data.campaigns.push(
      { id: 'c1', name: 'Old', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'c2', name: 'New', createdAt: '2025-01-01T00:00:00.000Z' }
    );
    const res = await request(app).get('/api/campaigns');
    expect(res.body.map((c) => c.id)).toEqual(['c2', 'c1']);
  });

  it('returns a single campaign by id', async () => {
    db.data.campaigns.push({ id: 'c1', name: 'X', createdAt: new Date().toISOString() });
    const res = await request(app).get('/api/campaigns/c1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('c1');
  });

  it('returns 404 for a campaign that does not exist', async () => {
    const res = await request(app).get('/api/campaigns/missing');
    expect(res.status).toBe(404);
  });
});
