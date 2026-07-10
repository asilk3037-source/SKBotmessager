import { Router } from 'express';
import whatsappService from '../services/whatsappService.js';
import { logAction } from '../services/auditLogService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json(whatsappService.getState());
});

router.post('/connect', (req, res) => {
  whatsappService.init();
  logAction('whatsapp.connect', { entity: 'whatsapp' }).catch(() => {});
  res.json(whatsappService.getState());
});

router.post('/logout', asyncHandler(async (req, res) => {
  await whatsappService.logout();
  logAction('whatsapp.logout', { entity: 'whatsapp' }).catch(() => {});
  res.json(whatsappService.getState());
}));

export default router;
