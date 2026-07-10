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
  const total = messages.length;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
  const start = (page - 1) * pageSize;

  res.json({ total, page, pageSize, messages: messages.slice(start, start + pageSize) });
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

const CSV_HEADERS = ['data', 'campanha', 'contato', 'destinatario', 'canal', 'status', 'erro', 'assunto', 'mensagem'];

// Prefix values that would otherwise open as a formula in Excel/Sheets
// (=, +, -, @) so importing user-controlled data (contact names, template
// content) can't execute anything when the export is opened.
function escapeCsv(v) {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function rowToCsvLine(row, campaignsById) {
  const campaign = campaignsById.get(row.campaignId);
  return [
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
    .map(escapeCsv)
    .join(',');
}

router.get('/export.csv', (req, res) => {
  const messages = filterMessages(req.query);
  const campaignsById = new Map(db.data.campaigns.map((c) => [c.id, c]));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-envios-${Date.now()}.csv"`);

  // Streamed row-by-row instead of building the whole file as one string in
  // memory first - keeps a large export's peak memory bounded to a few rows
  // instead of the full report, and lets the browser start downloading
  // immediately.
  res.write('﻿' + CSV_HEADERS.join(',')); // BOM so Excel opens UTF-8 accents correctly
  for (const row of messages) {
    res.write('\n' + rowToCsvLine(row, campaignsById));
  }
  res.end();
});

export default router;
