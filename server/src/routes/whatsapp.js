import { Router } from 'express';
import whatsappService from '../services/whatsappService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json(whatsappService.getState());
});

router.post('/connect', (req, res) => {
  whatsappService.init();
  res.json(whatsappService.getState());
});

router.post('/logout', asyncHandler(async (req, res) => {
  await whatsappService.logout();
  res.json(whatsappService.getState());
}));

export default router;
