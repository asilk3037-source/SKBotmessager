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

const TREND_DAYS = 14;
const CHANNELS = ['whatsapp', 'sms', 'email'];

function dayKey(isoString) {
  return isoString.slice(0, 10); // "2025-01-01T10:00:00.000Z" -> "2025-01-01"
}

router.get('/dashboard', (req, res) => {
  const messages = db.data.messages;
  const campaigns = db.data.campaigns;

  const messagesSent = messages.filter((m) => m.status === 'sent').length;
  const messagesFailed = messages.filter((m) => m.status === 'failed').length;
  const messagesPending = messages.filter((m) => m.status === 'pending').length;
  const totals = {
    campaigns: campaigns.length,
    messagesSent,
    messagesFailed,
    messagesPending,
    messagesTotal: messages.length
  };

  const delivered = messagesSent + messagesFailed;
  const deliveryRate = delivered > 0 ? Math.round((messagesSent / delivered) * 1000) / 10 : null;

  const byChannel = CHANNELS.map((channel) => {
    const channelMessages = messages.filter((m) => m.channel === channel);
    return {
      channel,
      sent: channelMessages.filter((m) => m.status === 'sent').length,
      failed: channelMessages.filter((m) => m.status === 'failed').length,
      pending: channelMessages.filter((m) => m.status === 'pending').length,
      total: channelMessages.length
    };
  }).filter((c) => c.total > 0);

  // Last TREND_DAYS calendar days (UTC), oldest first, zero-filled so the
  // chart always has a continuous x-axis even on days with no activity.
  const today = new Date();
  const trendByDay = new Map();
  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    trendByDay.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10), sent: 0, failed: 0 });
  }
  for (const m of messages) {
    const bucket = trendByDay.get(dayKey(m.createdAt));
    if (!bucket) continue; // outside the trend window
    if (m.status === 'sent') bucket.sent += 1;
    else if (m.status === 'failed') bucket.failed += 1;
  }
  const trend = [...trendByDay.values()];

  const recentCampaigns = [...campaigns]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((c) => {
      const campaignMessages = messages.filter((m) => m.campaignId === c.id);
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        createdAt: c.createdAt,
        sent: campaignMessages.filter((m) => m.status === 'sent').length,
        failed: campaignMessages.filter((m) => m.status === 'failed').length,
        total: campaignMessages.length
      };
    });

  res.json({ totals, deliveryRate, byChannel, trend, recentCampaigns });
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
