import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDb } from './testUtils.js';
import db from '../../db/index.js';

const app = createApp();

beforeEach(async () => {
  await resetDb();
  db.data.campaigns.push({ id: 'camp-1', name: 'Campanha A', createdAt: '2025-01-01T00:00:00.000Z' });
  db.data.messages.push(
    {
      id: 'm1',
      campaignId: 'camp-1',
      contactName: 'Joao',
      recipient: '11988887777',
      channel: 'sms',
      status: 'sent',
      error: null,
      subject: '',
      content: 'Oi Joao',
      createdAt: '2025-01-01T10:00:00.000Z'
    },
    {
      id: 'm2',
      campaignId: 'camp-1',
      contactName: 'Maria',
      recipient: 'maria@example.com',
      channel: 'email',
      status: 'failed',
      error: 'Connection timeout',
      subject: 'Assunto',
      content: 'Oi Maria',
      createdAt: '2025-01-02T10:00:00.000Z'
    }
  );
});

describe('GET /api/reports/messages', () => {
  it('returns all messages sorted by most recent first', async () => {
    const res = await request(app).get('/api/reports/messages');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.messages.map((m) => m.id)).toEqual(['m2', 'm1']);
  });

  it('paginates results, keeping "total" as the full filtered count', async () => {
    const res = await request(app).get('/api/reports/messages').query({ pageSize: 1, page: 2 });
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].id).toBe('m1');
  });

  it('filters by campaignId', async () => {
    const res = await request(app).get('/api/reports/messages').query({ campaignId: 'no-such-campaign' });
    expect(res.body.total).toBe(0);
  });

  it('filters by channel', async () => {
    const res = await request(app).get('/api/reports/messages').query({ channel: 'email' });
    expect(res.body.total).toBe(1);
    expect(res.body.messages[0].id).toBe('m2');
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/reports/messages').query({ status: 'sent' });
    expect(res.body.total).toBe(1);
    expect(res.body.messages[0].id).toBe('m1');
  });

  it('filters by date range (from/to)', async () => {
    const res = await request(app)
      .get('/api/reports/messages')
      .query({ from: '2025-01-02T00:00:00.000Z' });
    expect(res.body.total).toBe(1);
    expect(res.body.messages[0].id).toBe('m2');
  });

  it('filters by the "to" end of the date range', async () => {
    const res = await request(app)
      .get('/api/reports/messages')
      .query({ to: '2025-01-01T23:59:59.000Z' });
    expect(res.body.total).toBe(1);
    expect(res.body.messages[0].id).toBe('m1');
  });
});

describe('GET /api/reports/summary', () => {
  it('aggregates totals and lists campaigns', async () => {
    const res = await request(app).get('/api/reports/summary');
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({
      campaigns: 1,
      messagesSent: 1,
      messagesFailed: 1,
      messagesTotal: 2
    });
    expect(res.body.campaigns).toHaveLength(1);
  });
});

describe('GET /api/reports/dashboard', () => {
  it('aggregates totals, delivery rate, per-channel and recent campaign stats', async () => {
    const res = await request(app).get('/api/reports/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({
      campaigns: 1,
      messagesSent: 1,
      messagesFailed: 1,
      messagesPending: 0,
      messagesTotal: 2
    });
    expect(res.body.deliveryRate).toBe(50); // 1 sent / (1 sent + 1 failed)

    expect(res.body.byChannel).toEqual(
      expect.arrayContaining([
        { channel: 'sms', sent: 1, failed: 0, pending: 0, total: 1 },
        { channel: 'email', sent: 0, failed: 1, pending: 0, total: 1 }
      ])
    );
    // whatsapp has no messages in this fixture, so it's omitted rather than a zero row
    expect(res.body.byChannel.find((c) => c.channel === 'whatsapp')).toBeUndefined();

    expect(res.body.recentCampaigns).toHaveLength(1);
    expect(res.body.recentCampaigns[0]).toMatchObject({ id: 'camp-1', name: 'Campanha A', sent: 1, failed: 1, total: 2 });
  });

  it('returns a null delivery rate and zero-filled trend when there is no data', async () => {
    db.data.messages = [];
    db.data.campaigns = [];

    const res = await request(app).get('/api/reports/dashboard');

    expect(res.body.deliveryRate).toBeNull();
    expect(res.body.byChannel).toEqual([]);
    expect(res.body.trend).toHaveLength(14);
    expect(res.body.trend.every((day) => day.sent === 0 && day.failed === 0)).toBe(true);
    expect(res.body.recentCampaigns).toEqual([]);
  });

  it('buckets a message sent today into the last day of the trend', async () => {
    const today = new Date().toISOString();
    db.data.messages.push({
      id: 'm-today',
      campaignId: 'camp-1',
      contactName: 'Ana',
      recipient: '11999998888',
      channel: 'whatsapp',
      status: 'sent',
      error: null,
      subject: '',
      content: 'Oi',
      createdAt: today
    });

    const res = await request(app).get('/api/reports/dashboard');
    const lastDay = res.body.trend[res.body.trend.length - 1];

    expect(lastDay.date).toBe(today.slice(0, 10));
    expect(lastDay.sent).toBe(1);
  });
});

describe('GET /api/reports/export.csv', () => {
  it('returns a UTF-8 CSV with a BOM, correct headers and escaped content', async () => {
    const res = await request(app).get('/api/reports/export.csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);

    const text = res.text;
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM
    const lines = text.slice(1).trim().split('\n');
    expect(lines[0]).toBe('data,campanha,contato,destinatario,canal,status,erro,assunto,mensagem');
    // Most recent message (m2) comes first.
    expect(lines[1]).toContain('Campanha A');
    expect(lines[1]).toContain('maria@example.com');
    expect(lines[1]).toContain('Connection timeout');
  });

  it('respects the same filters as /messages', async () => {
    const res = await request(app).get('/api/reports/export.csv').query({ channel: 'sms' });
    const lines = res.text.slice(1).trim().split('\n');
    expect(lines).toHaveLength(2); // header + one data row
    expect(lines[1]).toContain('11988887777');
  });

  it('leaves campaign/error/subject columns blank instead of "null"/"undefined"', async () => {
    db.data.campaigns = []; // the message's campaignId no longer resolves to a campaign
    db.data.messages = [
      {
        id: 'm3',
        campaignId: 'gone',
        contactName: 'Pedro',
        recipient: '111',
        channel: 'sms',
        status: 'sent',
        error: null,
        subject: null,
        content: 'oi',
        createdAt: '2025-01-03T00:00:00.000Z'
      }
    ];

    const res = await request(app).get('/api/reports/export.csv');
    const [, dataLine] = res.text.slice(1).trim().split('\n');

    expect(dataLine).toBe('"2025-01-03T00:00:00.000Z","","Pedro","111","sms","sent","","","oi"');
  });

  it('neutralizes values that start with a formula-trigger character', async () => {
    db.data.messages = [
      {
        id: 'm4',
        campaignId: 'camp-1',
        contactName: '=HYPERLINK("https://evil.example","click")',
        recipient: '111',
        channel: 'sms',
        status: 'sent',
        error: null,
        subject: null,
        content: '+1+1',
        createdAt: '2025-01-04T00:00:00.000Z'
      }
    ];

    const res = await request(app).get('/api/reports/export.csv');
    const [, dataLine] = res.text.slice(1).trim().split('\n');

    expect(dataLine).toContain('"\'=HYPERLINK(""https://evil.example"",""click"")"');
    expect(dataLine).toContain('"\'+1+1"');
  });

  it('streams just the header row (no trailing newline) when there are no matching messages', async () => {
    db.data.messages = [];

    const res = await request(app).get('/api/reports/export.csv');

    expect(res.text.slice(1)).toBe('data,campanha,contato,destinatario,canal,status,erro,assunto,mensagem');
  });
});
