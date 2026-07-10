import { Router } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import db from '../db/index.js';
import { parseSpreadsheetInWorker, normalizePhone, normalizeEmail } from '../services/spreadsheetParser.js';
import { logAction } from '../services/auditLogService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/\.(xlsx|csv)$/i.test(file.originalname)) {
      return cb(new Error('Apenas arquivos .xlsx ou .csv são aceitos.'));
    }
    cb(null, true);
  }
});
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const router = Router();

// Wraps upload.single() so a rejected file (wrong extension, over the size
// limit) becomes a clear 400 instead of falling through to the generic
// error handler as a 500.
function uploadSpreadsheet(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// Step 1: upload a spreadsheet and get back a preview (columns + rows) without persisting yet
router.post('/preview', uploadSpreadsheet, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  try {
    const preview = await parseSpreadsheetInWorker(req.file.buffer, req.file.originalname);
    res.json(preview);
  } catch (err) {
    res.status(400).json({ error: `Não foi possível ler a planilha: ${err.message}` });
  }
});

// Step 2: confirm the import with column mapping chosen by the user
router.post('/import', asyncHandler(async (req, res) => {
  const { fileName, rows, nameColumn, phoneColumn, emailColumn, extraColumns = [], batchLabel } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Nenhuma linha para importar.' });
  }
  if (!nameColumn || (!phoneColumn && !emailColumn)) {
    return res.status(400).json({ error: 'Informe a coluna de nome e ao menos uma de telefone ou email.' });
  }

  const batchId = nanoid();
  const now = new Date().toISOString();

  const imported = [];
  const skipped = [];

  for (const row of rows) {
    const phone = phoneColumn ? normalizePhone(row[phoneColumn]) : '';
    const email = emailColumn ? normalizeEmail(row[emailColumn]) : '';
    const name = String(row[nameColumn] ?? '').trim();

    const validPhone = phone && phone.replace('+', '').length >= 8;
    const validEmail = Boolean(email);

    if (!validPhone && !validEmail) {
      skipped.push({ row, reason: 'Telefone e email inválidos ou vazios' });
      continue;
    }

    const extras = {};
    for (const col of extraColumns) {
      if (UNSAFE_KEYS.has(col)) continue;
      if (col !== nameColumn && col !== phoneColumn && col !== emailColumn) {
        extras[col] = row[col];
      }
    }

    imported.push({
      id: nanoid(),
      batchId,
      name: name || '(sem nome)',
      phone: validPhone ? phone : '',
      email: validEmail ? email : '',
      extras,
      createdAt: now
    });
  }

  db.data.batches.push({
    id: batchId,
    label: batchLabel || fileName || `Importação ${new Date(now).toLocaleString('pt-BR')}`,
    fileName: fileName || null,
    totalRows: rows.length,
    importedCount: imported.length,
    skippedCount: skipped.length,
    createdAt: now
  });
  db.data.contacts.push(...imported);
  await db.write();
  // Fire-and-forget: the entry is pushed synchronously (before logAction's
  // own await), so it's already in db.data.auditLog by the time this
  // handler returns - but the response itself never waits on it.
  logAction('contacts.import', {
    entity: 'batch',
    entityId: batchId,
    meta: { label: batchLabel || fileName, importedCount: imported.length, skippedCount: skipped.length }
  }).catch(() => {});

  res.status(201).json({
    batchId,
    importedCount: imported.length,
    skippedCount: skipped.length,
    skipped: skipped.slice(0, 50)
  });
}));

router.get('/batches', (req, res) => {
  const batches = [...db.data.batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(batches);
});

router.delete('/batches/:batchId', asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const batch = db.data.batches.find((b) => b.id === batchId);
  const before = db.data.contacts.length;
  db.data.contacts = db.data.contacts.filter((c) => c.batchId !== batchId);
  db.data.batches = db.data.batches.filter((b) => b.id !== batchId);
  await db.write();
  const removedContacts = before - db.data.contacts.length;
  logAction('batches.delete', {
    entity: 'batch',
    entityId: batchId,
    meta: { label: batch?.label ?? null, removedContacts }
  }).catch(() => {});
  res.json({ removedContacts });
}));

router.get('/', (req, res) => {
  const { batchId, search } = req.query;
  let contacts = db.data.contacts;

  if (batchId) {
    contacts = contacts.filter((c) => c.batchId === batchId);
  }
  if (search) {
    const term = String(search).toLowerCase();
    contacts = contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        (c.email ?? '').includes(term)
    );
  }

  const total = contacts.length;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
  const start = (page - 1) * pageSize;

  res.json({ total, page, pageSize, contacts: contacts.slice(start, start + pageSize) });
});

router.delete('/:id', asyncHandler(async (req, res) => {
  const contact = db.data.contacts.find((c) => c.id === req.params.id);
  const before = db.data.contacts.length;
  db.data.contacts = db.data.contacts.filter((c) => c.id !== req.params.id);
  await db.write();
  if (db.data.contacts.length === before) {
    return res.status(404).json({ error: 'Contato não encontrado.' });
  }
  logAction('contacts.delete', { entity: 'contact', entityId: req.params.id, meta: { name: contact?.name ?? null } }).catch(() => {});
  res.status(204).end();
}));

export default router;
