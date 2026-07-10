import { nanoid } from 'nanoid';
import db from '../db/index.js';
import { renderTemplate } from './renderTemplate.js';
import whatsappService from './whatsappService.js';
import { sendSms } from './smsService.js';
import { sendEmail } from './emailService.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Re-serializing the whole db.json after every single message is a real I/O
// bottleneck for large campaigns; flush periodically instead, plus always at
// the end so progress polling never drifts far from what's on disk.
const WRITE_BATCH_SIZE = 20;

function getRecipient(channel, contact) {
  if (channel === 'whatsapp' || channel === 'sms') return contact.phone || '';
  if (channel === 'email') return contact.email || '';
  return '';
}

async function sendOne(channel, contact, text, subject) {
  if (channel === 'whatsapp') {
    await whatsappService.sendMessage(contact.phone, text);
  } else if (channel === 'sms') {
    await sendSms(contact.phone, text);
  } else if (channel === 'email') {
    await sendEmail(contact.email, subject, text);
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

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const isLast = i === contacts.length - 1;
    const text = renderTemplate(template.content, contact);
    const subject = template.subject ? renderTemplate(template.subject, contact) : '';
    const recipient = getRecipient(campaign.channel, contact);

    const message = {
      id: nanoid(),
      campaignId,
      contactId: contact.id,
      contactName: contact.name,
      recipient,
      channel: campaign.channel,
      content: text,
      subject,
      status: 'pending',
      error: null,
      createdAt: now(),
      sentAt: null
    };
    db.data.messages.push(message);

    if (!recipient) {
      message.status = 'failed';
      message.error = campaign.channel === 'email'
        ? 'Contato sem email cadastrado.'
        : 'Contato sem telefone cadastrado.';
      campaign.failedCount += 1;
    } else {
      try {
        await sendOne(campaign.channel, contact, text, subject);
        message.status = 'sent';
        message.sentAt = now();
        campaign.sentCount += 1;
      } catch (err) {
        message.status = 'failed';
        message.error = err.message || String(err);
        campaign.failedCount += 1;
      }
    }

    campaign.processedCount += 1;

    if (isLast || (i + 1) % WRITE_BATCH_SIZE === 0) {
      await db.write();
    }

    if (!isLast) {
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
    scheduledAt: null,
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

export async function scheduleCampaign({ name, templateId, channel, contactIds, scheduledAt }) {
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
    status: 'scheduled',
    scheduledAt,
    error: null,
    createdAt: now,
    finishedAt: null
  };
  db.data.campaigns.push(campaign);
  await db.write();
  return campaign;
}

export async function cancelScheduledCampaign(id) {
  const campaign = db.data.campaigns.find((c) => c.id === id);
  if (!campaign) return { ok: false, reason: 'not_found' };
  if (campaign.status !== 'scheduled') return { ok: false, reason: 'not_scheduled', campaign };

  campaign.status = 'cancelled';
  await db.write();
  return { ok: true, campaign };
}

// Starts any campaign whose scheduled time has arrived. Meant to be polled
// periodically (see campaignScheduler.js) rather than driven by a per-campaign
// timer, so a scheduled send still fires even if the app was closed and
// reopened after the target time.
export async function runDueScheduledCampaigns() {
  const nowIso = new Date().toISOString();
  const due = db.data.campaigns.filter((c) => c.status === 'scheduled' && c.scheduledAt <= nowIso);
  if (due.length === 0) return;

  for (const campaign of due) {
    campaign.status = 'running';
  }
  await db.write();

  for (const campaign of due) {
    runCampaign(campaign.id).catch(async (err) => {
      campaign.status = 'failed';
      campaign.error = err.message || String(err);
      await db.write();
    });
  }
}
