import { nanoid } from 'nanoid';
import db from '../db/index.js';

// Bounds memory/disk use for a long-running install - old entries roll off
// rather than growing db.json forever. 2000 entries is generous for a
// single-user local app's history.
const MAX_ENTRIES = 2000;

export async function logAction(action, { entity = null, entityId = null, meta = null } = {}) {
  db.data.auditLog ??= [];
  db.data.auditLog.push({
    id: nanoid(),
    action,
    entity,
    entityId,
    meta,
    createdAt: new Date().toISOString()
  });

  if (db.data.auditLog.length > MAX_ENTRIES) {
    db.data.auditLog.splice(0, db.data.auditLog.length - MAX_ENTRIES);
  }

  await db.write();
}
