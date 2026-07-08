import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDb } from './testUtils.js';
import db from '../../db/index.js';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

describe('GET /api/templates', () => {
  it('lists templates sorted by most recently created first', async () => {
    db.data.templates.push(
      { id: 't1', name: 'Antigo', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 't2', name: 'Recente', createdAt: '2025-01-01T00:00:00.000Z' }
    );
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.id)).toEqual(['t2', 't1']);
  });
});

describe('POST /api/templates', () => {
  it('requires name and content', async () => {
    const res = await request(app).post('/api/templates').send({ name: 'Sem conteudo' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nome e conteúdo/i);
  });

  it('rejects an invalid channel', async () => {
    const res = await request(app)
      .post('/api/templates')
      .send({ name: 'T', content: 'C', channel: 'fax' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/canal inválido/i);
  });

  it('creates a template defaulting channel to "any" and subject to ""', async () => {
    const res = await request(app).post('/api/templates').send({ name: 'T', content: 'Ola {{nome}}' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'T', content: 'Ola {{nome}}', channel: 'any', subject: '', isDefault: false });
    expect(db.data.templates).toHaveLength(1);
  });

  it('unsets other defaults for the same channel when creating a new default', async () => {
    db.data.templates.push({ id: 't1', name: 'Old default', channel: 'sms', isDefault: true, createdAt: '2024-01-01' });

    const res = await request(app)
      .post('/api/templates')
      .send({ name: 'New', content: 'C', channel: 'sms', isDefault: true });

    expect(res.status).toBe(201);
    const old = db.data.templates.find((t) => t.id === 't1');
    expect(old.isDefault).toBe(false);
  });

  it('an "any" channel default unsets defaults across every channel', async () => {
    db.data.templates.push(
      { id: 't1', name: 'A', channel: 'sms', isDefault: true, createdAt: '2024-01-01' },
      { id: 't2', name: 'B', channel: 'whatsapp', isDefault: true, createdAt: '2024-01-01' }
    );

    await request(app).post('/api/templates').send({ name: 'C', content: 'c', channel: 'any', isDefault: true });

    expect(db.data.templates.find((t) => t.id === 't1').isDefault).toBe(false);
    expect(db.data.templates.find((t) => t.id === 't2').isDefault).toBe(false);
  });
});

describe('PUT /api/templates/:id', () => {
  it('returns 404 for a template that does not exist', async () => {
    const res = await request(app).put('/api/templates/missing').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid channel on update', async () => {
    db.data.templates.push({ id: 't1', name: 'T', content: 'C', channel: 'sms', createdAt: '2024-01-01' });
    const res = await request(app).put('/api/templates/t1').send({ channel: 'fax' });
    expect(res.status).toBe(400);
  });

  it('updates only the provided fields', async () => {
    db.data.templates.push({
      id: 't1',
      name: 'Old',
      content: 'Old content',
      subject: '',
      channel: 'sms',
      isDefault: false,
      createdAt: '2024-01-01'
    });

    const res = await request(app).put('/api/templates/t1').send({ name: 'New name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New name');
    expect(res.body.content).toBe('Old content');
  });

  it('setting isDefault true unsets other defaults on the same channel', async () => {
    db.data.templates.push(
      { id: 't1', name: 'A', channel: 'sms', isDefault: true, createdAt: '2024-01-01' },
      { id: 't2', name: 'B', channel: 'sms', isDefault: false, createdAt: '2024-01-01' }
    );

    await request(app).put('/api/templates/t2').send({ isDefault: true });

    expect(db.data.templates.find((t) => t.id === 't1').isDefault).toBe(false);
    expect(db.data.templates.find((t) => t.id === 't2').isDefault).toBe(true);
  });

  it('setting isDefault false clears the flag', async () => {
    db.data.templates.push({ id: 't1', name: 'A', channel: 'sms', isDefault: true, createdAt: '2024-01-01' });
    const res = await request(app).put('/api/templates/t1').send({ isDefault: false });
    expect(res.body.isDefault).toBe(false);
  });
});

describe('DELETE /api/templates/:id', () => {
  it('deletes an existing template', async () => {
    db.data.templates.push({ id: 't1', name: 'A', createdAt: '2024-01-01' });
    const res = await request(app).delete('/api/templates/t1');
    expect(res.status).toBe(204);
    expect(db.data.templates).toHaveLength(0);
  });

  it('returns 404 when the template does not exist', async () => {
    const res = await request(app).delete('/api/templates/missing');
    expect(res.status).toBe(404);
  });
});
