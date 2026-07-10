import { Router } from 'express';
import db from '../db/index.js';
import { listProviders } from '../services/smsService.js';
import { sendTestWebhook } from '../services/webhookService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Never send stored secrets back to the client. Each secret field is blanked
// out and replaced with a `*Set` boolean so the UI can show "already
// configured" without ever exposing the value over the network.
function maskSettings(settings) {
  return {
    sms: {
      ...settings.sms,
      authToken: '',
      authTokenSet: Boolean(settings.sms.authToken),
      password: '',
      passwordSet: Boolean(settings.sms.password)
    },
    email: {
      ...settings.email,
      appPassword: '',
      appPasswordSet: Boolean(settings.email.appPassword)
    },
    delayBetweenMessagesMs: settings.delayBetweenMessagesMs,
    webhookUrl: settings.webhookUrl
  };
}

router.get('/', (req, res) => {
  res.json({
    settings: maskSettings(db.data.settings),
    smsProviders: listProviders()
  });
});

router.put('/', asyncHandler(async (req, res) => {
  const { sms, email, delayBetweenMessagesMs, webhookUrl } = req.body;

  if (webhookUrl) {
    try {
      const parsed = new URL(webhookUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: 'webhookUrl deve ser um endereço http:// ou https://.' });
      }
    } catch {
      return res.status(400).json({ error: 'webhookUrl inválida.' });
    }
  }

  if (sms?.baseUrl) {
    // The Android SMS gateway is meant to be pointed at a phone on the local
    // network (http://) or the vendor's cloud relay (https://) — only block
    // other/malformed protocols, since that's the actual SSRF-relevant risk.
    try {
      const parsed = new URL(sms.baseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: 'baseUrl deve ser um endereço http:// ou https://.' });
      }
    } catch {
      return res.status(400).json({ error: 'baseUrl inválida.' });
    }
  }

  if (sms) {
    // A blank secret field means "leave it as is" (the client never receives
    // the real value to send back) - only a non-empty value overwrites it.
    const { authTokenSet, passwordSet, ...incoming } = sms;
    const merged = { ...db.data.settings.sms, ...incoming };
    if (!incoming.authToken) merged.authToken = db.data.settings.sms.authToken;
    if (!incoming.password) merged.password = db.data.settings.sms.password;
    db.data.settings.sms = merged;
  }
  if (email) {
    const { appPasswordSet, ...incoming } = email;
    const merged = { ...db.data.settings.email, ...incoming };
    if (!incoming.appPassword) merged.appPassword = db.data.settings.email.appPassword;
    db.data.settings.email = merged;
  }
  if (typeof delayBetweenMessagesMs === 'number' && delayBetweenMessagesMs >= 500) {
    db.data.settings.delayBetweenMessagesMs = delayBetweenMessagesMs;
  }
  if (typeof webhookUrl === 'string') {
    db.data.settings.webhookUrl = webhookUrl;
  }

  await db.write();
  res.json(maskSettings(db.data.settings));
}));

router.post('/test-webhook', asyncHandler(async (req, res) => {
  const url = req.body?.webhookUrl || db.data.settings.webhookUrl;
  if (!url) {
    return res.status(400).json({ error: 'Nenhuma URL de webhook configurada.' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'webhookUrl inválida.' });
  }

  const result = await sendTestWebhook(url);
  if (!result.sent) {
    return res.status(502).json({ ...result, error: 'Não foi possível entregar o webhook de teste.' });
  }
  res.json({ ok: true });
}));

export default router;
