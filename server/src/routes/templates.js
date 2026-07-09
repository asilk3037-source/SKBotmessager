import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const VALID_CHANNELS = ['whatsapp', 'sms', 'email', 'any'];

router.get('/', (req, res) => {
  res.json([...db.data.templates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

router.post('/', asyncHandler(async (req, res) => {
  const { name, content, subject = '', channel = 'any', isDefault = false } = req.body;

  if (!name || !content) {
    return res.status(400).json({ error: 'Nome e conteúdo são obrigatórios.' });
  }
  if (!VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: 'Canal inválido.' });
  }

  const now = new Date().toISOString();

  if (isDefault) {
    db.data.templates.forEach((t) => {
      if (t.channel === channel || channel === 'any') t.isDefault = false;
    });
  }

  const template = {
    id: nanoid(),
    name,
    content,
    subject,
    channel,
    isDefault: Boolean(isDefault),
    createdAt: now,
    updatedAt: now
  };
  db.data.templates.push(template);
  await db.write();
  res.status(201).json(template);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const template = db.data.templates.find((t) => t.id === req.params.id);
  if (!template) return res.status(404).json({ error: 'Template não encontrado.' });

  const { name, content, subject, channel, isDefault } = req.body;
  if (channel && !VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: 'Canal inválido.' });
  }

  if (name !== undefined) template.name = name;
  if (content !== undefined) template.content = content;
  if (subject !== undefined) template.subject = subject;
  if (channel !== undefined) template.channel = channel;
  if (isDefault) {
    db.data.templates.forEach((t) => {
      if (t.id !== template.id && (t.channel === template.channel || template.channel === 'any')) {
        t.isDefault = false;
      }
    });
    template.isDefault = true;
  } else if (isDefault === false) {
    template.isDefault = false;
  }
  template.updatedAt = new Date().toISOString();

  await db.write();
  res.json(template);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const before = db.data.templates.length;
  db.data.templates = db.data.templates.filter((t) => t.id !== req.params.id);
  await db.write();
  if (db.data.templates.length === before) {
    return res.status(404).json({ error: 'Template não encontrado.' });
  }
  res.status(204).end();
}));

export default router;
