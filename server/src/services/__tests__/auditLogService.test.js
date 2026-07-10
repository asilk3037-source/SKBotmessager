import { describe, it, expect, beforeEach } from 'vitest';

const db = (await import('../../db/index.js')).default;
const { logAction } = await import('../auditLogService.js');

beforeEach(() => {
  db.data.auditLog = [];
});

describe('logAction', () => {
  it('appends an entry with action, entity, entityId, meta and a timestamp', async () => {
    await logAction('templates.create', { entity: 'template', entityId: 't1', meta: { name: 'Boas-vindas' } });

    expect(db.data.auditLog).toHaveLength(1);
    const entry = db.data.auditLog[0];
    expect(entry).toMatchObject({ action: 'templates.create', entity: 'template', entityId: 't1', meta: { name: 'Boas-vindas' } });
    expect(entry.id).toEqual(expect.any(String));
    expect(entry.createdAt).toEqual(expect.any(String));
  });

  it('defaults entity/entityId/meta to null when not provided', async () => {
    await logAction('whatsapp.connect');
    expect(db.data.auditLog[0]).toMatchObject({ action: 'whatsapp.connect', entity: null, entityId: null, meta: null });
  });

  it('pushes the entry synchronously, before its own db.write() resolves', () => {
    // Callers rely on this to observe the entry immediately after firing
    // logAction() without awaiting it (see the fire-and-forget usage in routes).
    const promise = logAction('templates.delete', { entity: 'template', entityId: 't1' });
    expect(db.data.auditLog).toHaveLength(1);
    return promise;
  });

  it('caps the log at 2000 entries, dropping the oldest first', async () => {
    db.data.auditLog = Array.from({ length: 2000 }, (_, i) => ({
      id: `old-${i}`,
      action: 'x',
      entity: null,
      entityId: null,
      meta: null,
      createdAt: new Date(2020, 0, 1).toISOString()
    }));

    await logAction('templates.create', { entity: 'template', entityId: 'newest' });

    expect(db.data.auditLog).toHaveLength(2000);
    expect(db.data.auditLog[0].id).toBe('old-1'); // old-0 rolled off
    expect(db.data.auditLog[1999].entityId).toBe('newest');
  });
});
