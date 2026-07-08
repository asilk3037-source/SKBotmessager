import { nanoid } from 'nanoid';
import db from '../db/index.js';
import { renderTemplate } from './renderTemplate.js';
import whatsappService from './whatsappService.js';
import { sendSms } from './smsService.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendOne(channel, contact, text) {
  if (channel === 'whatsapp') {
    await whatsappService.sendMessage(contact.phone, text);
  } else if (channel === 'sms') {
    await sendSms(contact.phone, text);
  } else {
    throw new Error(`Canal inválido: ${channel}`);
  }
}

export async function runCampaign(campaignId) {
  const campaign = db.data.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return;

  const template = db.data.templates.find((t) => t.id === campaign.templateId);
  if (!template) {
    campaign.status = 'failed';
    campaign.error = 'Template não encontrado.';
    await db.write();
    return;
  }

  const contacts = campaign.contactIds
    .map((id) => db.data.contacts.find((c) => c.id === id))
    .filter(Boolean);

  const delayMs = db.data.settings.delayBetweenMessagesMs ?? 3000;
  const now = () => new Date().toISOString();

  for (const contact of contacts) {
    const text = renderTemplate(template.content, contact);
    const message = {
      id: nanoid(),
      campaignId,
      contactId: contact.id,
      contactName: contact.name,
      phone: contact.phone,
      channel: campaign.channel,
      content: text,
      status: 'pending',
      error: null,
      createdAt: now(),
      sentAt: null
    };
    db.data.messages.push(message);

    try {
      await sendOne(campaign.channel, contact, text);
      message.status = 'sent';
      message.sentAt = now();
      campaign.sentCount += 1;
    } catch (err) {
      message.status = 'failed';
      message.error = err.message || String(err);
      campaign.failedCount += 1;
    }

    campaign.processedCount += 1;
    await db.write();

    if (contact !== contacts[contacts.length - 1]) {
      await sleep(delayMs);
    }
  }

  campaign.status = 'completed';
  campaign.finishedAt = now();
  await db.write();
}

export async function startCampaign({ name, templateId, channel, contactIds }) {
  const now = new Date().toISOString();
  const campaign = {
    id: nanoid(),
    name,
    templateId,
    channel,
    contactIds,
    totalCount: contactIds.length,
    processedCount: 0,
    sentCount: 0,
    failedCount: 0,
    status: 'running',
    error: null,
    createdAt: now,
    finishedAt: null
  };
  db.data.campaigns.push(campaign);
  await db.write();

  // Fire and forget: the HTTP response returns immediately, progress is polled separately.
  runCampaign(campaign.id).catch(async (err) => {
    campaign.status = 'failed';
    campaign.error = err.message || String(err);
    await db.write();
  });

  return campaign;
}
