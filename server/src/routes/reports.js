import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

function filterMessages(query) {
  const { campaignId, channel, status, from, to } = query;
  let messages = db.data.messages;

  if (campaignId) messages = messages.filter((m) => m.campaignId === campaignId);
  if (channel) messages = messages.filter((m) => m.channel === channel);
  if (status) messages = messages.filter((m) => m.status === status);
  if (from) messages = messages.filter((m) => m.createdAt >= from);
  if (to) messages = messages.filter((m) => m.createdAt <= to);

  return [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

router.get('/messages', (req, res) => {
  const messages = filterMessages(req.query);
  res.json({ total: messages.length, messages });
});

router.get('/summary', (req, res) => {
  const campaigns = db.data.campaigns;
  const totals = {
    campaigns: campaigns.length,
    messagesSent: db.data.messages.filter((m) => m.status === 'sent').length,
    messagesFailed: db.data.messages.filter((m) => m.status === 'failed').length,
    messagesTotal: db.data.messages.length
  };
  res.json({ totals, campaigns: [...campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});

function toCsv(rows) {
  const headers = ['data', 'campanha', 'contato', 'destinatario', 'canal', 'status', 'erro', 'assunto', 'mensagem'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];

  for (const row of rows) {
    const campaign = db.data.campaigns.find((c) => c.id === row.campaignId);
    lines.push(
      [
        row.createdAt,
        campaign?.name ?? '',
        row.contactName,
        row.recipient,
        row.channel,
        row.status,
        row.error ?? '',
        row.subject ?? '',
        row.content
      ]
        .map(escape)
        .join(',')
    );
  }
  return lines.join('\n');
}

router.get('/export.csv', (req, res) => {
  const messages = filterMessages(req.query);
  const csv = toCsv(messages);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-envios-${Date.now()}.csv"`);
  res.send('﻿' + csv); // BOM so Excel opens UTF-8 accents correctly
});

export default router;
