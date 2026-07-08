import { Router } from 'express';
import db from '../db/index.js';
import { listProviders } from '../services/smsService.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    settings: db.data.settings,
    smsProviders: listProviders()
  });
});

router.put('/', async (req, res) => {
  const { sms, delayBetweenMessagesMs } = req.body;

  if (sms) {
    db.data.settings.sms = { ...db.data.settings.sms, ...sms };
  }
  if (typeof delayBetweenMessagesMs === 'number' && delayBetweenMessagesMs >= 500) {
    db.data.settings.delayBetweenMessagesMs = delayBetweenMessagesMs;
  }

  await db.write();
  res.json(db.data.settings);
});

export default router;
