import { Router } from 'express';
import db from '../db/index.js';
import { startCampaign, scheduleCampaign, cancelScheduledCampaign } from '../services/campaignRunner.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', (req, res) => {
  const campaigns = [...db.data.campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(campaigns);
});

router.get('/:id', (req, res) => {
  const campaign = db.data.campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
  res.json(campaign);
});

router.post('/', asyncHandler(async (req, res) => {
  const { name, templateId, channel, contactIds, scheduledAt } = req.body;

  if (!name || !templateId || !channel || !Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ error: 'name, templateId, channel e contactIds são obrigatórios.' });
  }
  if (!['whatsapp', 'sms', 'email'].includes(channel)) {
    return res.status(400).json({ error: 'Canal deve ser "whatsapp", "sms" ou "email".' });
  }
  const template = db.data.templates.find((t) => t.id === templateId);
  if (!template) {
    return res.status(404).json({ error: 'Template não encontrado.' });
  }

  if (scheduledAt) {
    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: 'Data de agendamento inválida.' });
    }
    if (scheduledDate.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'A data de agendamento deve ser no futuro.' });
    }
    const campaign = await scheduleCampaign({
      name,
      templateId,
      channel,
      contactIds,
      scheduledAt: scheduledDate.toISOString()
    });
    return res.status(201).json(campaign);
  }

  const campaign = await startCampaign({ name, templateId, channel, contactIds });
  res.status(201).json(campaign);
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const result = await cancelScheduledCampaign(req.params.id);
  if (!result.ok && result.reason === 'not_found') {
    return res.status(404).json({ error: 'Campanha não encontrada.' });
  }
  if (!result.ok) {
    return res.status(400).json({ error: 'Apenas campanhas agendadas podem ser canceladas.' });
  }
  res.json(result.campaign);
}));

export default router;
