import db from '../db/index.js';

const TIMEOUT_MS = 5000;

// Fire-and-forget by design: a slow/unreachable webhook endpoint must never
// delay or fail the campaign it's reporting on. Callers don't await the
// network call finishing, only that the attempt was dispatched.
export async function sendWebhookEvent(event, data) {
  const { webhookUrl } = db.data.settings;
  if (!webhookUrl) return { sent: false, reason: 'not_configured' };

  return postWebhook(webhookUrl, event, data);
}

export async function sendTestWebhook(url) {
  return postWebhook(url, 'test', { message: 'Evento de teste do SKBotmessager.' });
}

async function postWebhook(url, event, data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, timestamp: new Date().toISOString(), data }),
      signal: controller.signal
    });
    if (!res.ok) {
      return { sent: false, reason: 'http_error', status: res.status };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: 'network_error', error: err.message || String(err) };
  } finally {
    clearTimeout(timeout);
  }
}
