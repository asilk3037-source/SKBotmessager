import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDb } from './testUtils.js';
import db from '../../db/index.js';

const app = createApp();

beforeEach(async () => {
  await resetDb();
  db.data.auditLog = [
    { id: 'a1', action: 'templates.create', entity: 'template', entityId: 't1', meta: { name: 'A' }, createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'a2', action: 'contacts.delete', entity: 'contact', entityId: 'c1', meta: null, createdAt: '2025-01-02T00:00:00.000Z' },
    { id: 'a3', action: 'templates.create', entity: 'template', entityId: 't2', meta: { name: 'B' }, createdAt: '2025-01-03T00:00:00.000Z' }
  ];
  await db.write();
});

describe('GET /api/audit-log', () => {
  it('returns entries sorted by most recent first', async () => {
    const res = await request(app).get('/api/audit-log');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.entries.map((e) => e.id)).toEqual(['a3', 'a2', 'a1']);
  });

  it('filters by action', async () => {
    const res = await request(app).get('/api/audit-log').query({ action: 'templates.create' });
    expect(res.body.total).toBe(2);
    expect(res.body.entries.map((e) => e.id)).toEqual(['a3', 'a1']);
  });

  it('paginates results, keeping "total" as the full filtered count', async () => {
    const res = await request(app).get('/api/audit-log').query({ pageSize: 1, page: 2 });
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].id).toBe('a2');
  });

  it('returns an empty list when there is no audit history yet', async () => {
    db.data.auditLog = [];
    await db.write();

    const res = await request(app).get('/api/audit-log');
    expect(res.body.total).toBe(0);
    expect(res.body.entries).toEqual([]);
  });
});
