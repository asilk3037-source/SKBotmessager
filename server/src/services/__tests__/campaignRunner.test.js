import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMessageMock = vi.fn();
vi.mock('../whatsappService.js', () => ({
  default: { sendMessage: (...args) => sendMessageMock(...args) }
}));

const sendSmsMock = vi.fn();
vi.mock('../smsService.js', () => ({ sendSms: (...args) => sendSmsMock(...args) }));

const sendEmailMock = vi.fn();
vi.mock('../emailService.js', () => ({ sendEmail: (...args) => sendEmailMock(...args) }));

const sendWebhookEventMock = vi.fn().mockResolvedValue({ sent: false, reason: 'not_configured' });
vi.mock('../webhookService.js', () => ({ sendWebhookEvent: (...args) => sendWebhookEventMock(...args) }));

const db = (await import('../../db/index.js')).default;
const { runCampaign, startCampaign, scheduleCampaign, cancelScheduledCampaign, runDueScheduledCampaigns } =
  await import('../campaignRunner.js');

function addContact(overrides = {}) {
  const contact = {
    id: `contact-${db.data.contacts.length + 1}`,
    name: 'Joao',
    phone: '11988887777',
    email: 'joao@example.com',
    extras: {},
    ...overrides
  };
  db.data.contacts.push(contact);
  return contact;
}

function addTemplate(overrides = {}) {
  const template = {
    id: 'tpl-1',
    name: 'T',
    content: 'Ola {{nome}}',
    subject: 'Assunto para {{nome}}',
    channel: 'any',
    ...overrides
  };
  db.data.templates.push(template);
  return template;
}

beforeEach(() => {
  sendMessageMock.mockReset();
  sendSmsMock.mockReset();
  sendEmailMock.mockReset();
  sendWebhookEventMock.mockClear();
  sendWebhookEventMock.mockResolvedValue({ sent: false, reason: 'not_configured' });
  db.data.contacts = [];
  db.data.templates = [];
  db.data.campaigns = [];
  db.data.messages = [];
  db.data.settings.delayBetweenMessagesMs = 0;
});

describe('runCampaign', () => {
  it('does nothing if the campaign does not exist', async () => {
    await expect(runCampaign('missing')).resolves.toBeUndefined();
  });

  it('marks the campaign as failed when the template no longer exists', async () => {
    const contact = addContact();
    db.data.campaigns.push({
      id: 'camp-1',
      templateId: 'missing-template',
      channel: 'sms',
      contactIds: [contact.id],
      totalCount: 1,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    await runCampaign('camp-1');

    const campaign = db.data.campaigns[0];
    expect(campaign.status).toBe('failed');
    expect(campaign.error).toMatch(/template não encontrado/i);
    expect(sendWebhookEventMock).toHaveBeenCalledWith('campaign.failed', expect.objectContaining({ id: 'camp-1' }));
  });

  it('sends via WhatsApp, renders the template, and records a sent message', async () => {
    const contact = addContact({ name: 'Maria', phone: '21977776666' });
    const template = addTemplate({ content: 'Oi {{nome}}, tudo bem?' });
    sendMessageMock.mockResolvedValue(undefined);

    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'whatsapp',
      contactIds: [contact.id],
      totalCount: 1,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    await runCampaign('camp-1');

    expect(sendMessageMock).toHaveBeenCalledWith('21977776666', 'Oi Maria, tudo bem?');
    const campaign = db.data.campaigns[0];
    expect(campaign.status).toBe('completed');
    expect(campaign.sentCount).toBe(1);
    expect(campaign.failedCount).toBe(0);
    expect(campaign.processedCount).toBe(1);
    expect(campaign.finishedAt).toBeTruthy();

    expect(db.data.messages).toHaveLength(1);
    expect(db.data.messages[0]).toMatchObject({
      recipient: '21977776666',
      channel: 'whatsapp',
      status: 'sent',
      content: 'Oi Maria, tudo bem?'
    });
  });

  it('sends via SMS using the phone number', async () => {
    const contact = addContact({ phone: '11988887777' });
    const template = addTemplate();
    sendSmsMock.mockResolvedValue(undefined);

    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'sms',
      contactIds: [contact.id],
      totalCount: 1,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    await runCampaign('camp-1');

    expect(sendSmsMock).toHaveBeenCalledWith('11988887777', 'Ola Joao');
    expect(db.data.messages[0].status).toBe('sent');
  });

  it('sends via email using the address and rendered subject', async () => {
    const contact = addContact({ email: 'joao@example.com' });
    const template = addTemplate({ subject: 'Ola {{nome}}!' });
    sendEmailMock.mockResolvedValue(undefined);

    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'email',
      contactIds: [contact.id],
      totalCount: 1,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    await runCampaign('camp-1');

    expect(sendEmailMock).toHaveBeenCalledWith('joao@example.com', 'Ola Joao!', 'Ola Joao');
    expect(db.data.messages[0]).toMatchObject({ recipient: 'joao@example.com', subject: 'Ola Joao!' });
  });

  it('marks a contact without the required recipient field as failed, without calling the sender', async () => {
    const contact = addContact({ phone: '', email: '' });
    const template = addTemplate();

    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'sms',
      contactIds: [contact.id],
      totalCount: 1,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    await runCampaign('camp-1');

    expect(sendSmsMock).not.toHaveBeenCalled();
    const campaign = db.data.campaigns[0];
    expect(campaign.failedCount).toBe(1);
    expect(campaign.sentCount).toBe(0);
    expect(db.data.messages[0].error).toMatch(/sem telefone cadastrado/i);
  });

  it('uses an email-specific error message when the channel is email', async () => {
    const contact = addContact({ email: '' });
    const template = addTemplate();

    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'email',
      contactIds: [contact.id],
      totalCount: 1,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    await runCampaign('camp-1');

    expect(db.data.messages[0].error).toMatch(/sem email cadastrado/i);
  });

  it('records a failed message with the sender error but keeps processing the rest', async () => {
    const c1 = addContact({ id: 'c1', phone: '11111111111' });
    const c2 = addContact({ id: 'c2', phone: '22222222222' });
    const template = addTemplate();

    sendSmsMock.mockRejectedValueOnce(new Error('Número inválido')).mockResolvedValueOnce(undefined);

    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'sms',
      contactIds: [c1.id, c2.id],
      totalCount: 2,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    await runCampaign('camp-1');

    const campaign = db.data.campaigns[0];
    expect(campaign.sentCount).toBe(1);
    expect(campaign.failedCount).toBe(1);
    expect(campaign.processedCount).toBe(2);
    expect(campaign.status).toBe('completed');

    const [msg1, msg2] = db.data.messages;
    expect(msg1.status).toBe('failed');
    expect(msg1.error).toBe('Número inválido');
    expect(msg2.status).toBe('sent');
  });

  it('skips contacts that no longer exist without crashing', async () => {
    const template = addTemplate();
    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'sms',
      contactIds: ['ghost-contact'],
      totalCount: 1,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    await runCampaign('camp-1');

    const campaign = db.data.campaigns[0];
    expect(campaign.status).toBe('completed');
    expect(campaign.processedCount).toBe(0);
    expect(db.data.messages).toHaveLength(0);
  });

  it('waits delayBetweenMessagesMs between messages but not after the last one', async () => {
    const c1 = addContact({ id: 'c1', phone: '111' });
    const c2 = addContact({ id: 'c2', phone: '222' });
    const template = addTemplate();
    sendSmsMock.mockResolvedValue(undefined);
    db.data.settings.delayBetweenMessagesMs = 5;

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'sms',
      contactIds: [c1.id, c2.id],
      totalCount: 2,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    await runCampaign('camp-1');

    // Exactly one sleep between the two contacts, none after the last one.
    const delayCalls = setTimeoutSpy.mock.calls.filter((call) => call[1] === 5);
    expect(delayCalls).toHaveLength(1);

    setTimeoutSpy.mockRestore();
  });

  it('still waits between messages when the same contact id is selected twice (no reference-equality skip)', async () => {
    const c1 = addContact({ id: 'c1', phone: '111' });
    const template = addTemplate();
    sendSmsMock.mockResolvedValue(undefined);
    db.data.settings.delayBetweenMessagesMs = 5;

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'sms',
      contactIds: [c1.id, c1.id, c1.id],
      totalCount: 3,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    await runCampaign('camp-1');

    // Same underlying contact object resolved 3 times via .find() - the loop
    // must still treat the first two as "not last" and sleep, based on index,
    // not on object identity.
    const delayCalls = setTimeoutSpy.mock.calls.filter((call) => call[1] === 5);
    expect(delayCalls).toHaveLength(2);
    expect(db.data.messages).toHaveLength(3);

    setTimeoutSpy.mockRestore();
  });

  it('batches db.write() instead of writing once per message', async () => {
    const c1 = addContact({ id: 'c1', phone: '111' });
    const c2 = addContact({ id: 'c2', phone: '222' });
    const template = addTemplate();
    sendSmsMock.mockResolvedValue(undefined);

    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'sms',
      contactIds: [c1.id, c2.id],
      totalCount: 2,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'running'
    });

    const writeSpy = vi.spyOn(db, 'write');
    await runCampaign('camp-1');

    // One flush for the last message in the loop, one for the final
    // "completed" status - not one per message sent.
    expect(writeSpy).toHaveBeenCalledTimes(2);

    writeSpy.mockRestore();
  });
});

describe('startCampaign', () => {
  it('persists the campaign in "running" state before returning, and lets it complete asynchronously', async () => {
    const contact = addContact();
    const template = addTemplate();
    sendSmsMock.mockResolvedValue(undefined);

    const campaign = await startCampaign({
      name: 'Disparo teste',
      templateId: template.id,
      channel: 'sms',
      contactIds: [contact.id]
    });

    expect(campaign.status).toBe('running');
    expect(campaign.totalCount).toBe(1);
    expect(db.data.campaigns.find((c) => c.id === campaign.id)).toBeTruthy();

    // Let the fire-and-forget runCampaign() finish.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    const updated = db.data.campaigns.find((c) => c.id === campaign.id);
    expect(updated.status).toBe('completed');
    expect(updated.sentCount).toBe(1);

    expect(sendWebhookEventMock).toHaveBeenCalledWith(
      'campaign.completed',
      expect.objectContaining({ id: campaign.id, sentCount: 1, failedCount: 0 })
    );
  });

  it('marks the campaign as failed if runCampaign rejects unexpectedly', async () => {
    const contact = addContact();
    // template.content is null: renderTemplate() throws a TypeError outside runCampaign's
    // per-message try/catch, so the whole runCampaign() promise rejects - this exercises the
    // safety-net .catch() in startCampaign that keeps that rejection from being unhandled.
    const template = addTemplate({ content: null });

    const campaign = await startCampaign({
      name: 'Disparo teste',
      templateId: template.id,
      channel: 'sms',
      contactIds: [contact.id]
    });

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    const updated = db.data.campaigns.find((c) => c.id === campaign.id);
    expect(updated.status).toBe('failed');
    expect(updated.error).toMatch(/cannot read prop|null/i);

    expect(sendWebhookEventMock).toHaveBeenCalledWith(
      'campaign.failed',
      expect.objectContaining({ id: campaign.id, status: 'failed' })
    );
  });
});

describe('scheduleCampaign', () => {
  it('persists the campaign in "scheduled" state and does not send anything', async () => {
    const contact = addContact();
    const template = addTemplate();
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();

    const campaign = await scheduleCampaign({
      name: 'Disparo agendado',
      templateId: template.id,
      channel: 'sms',
      contactIds: [contact.id],
      scheduledAt
    });

    expect(campaign.status).toBe('scheduled');
    expect(campaign.scheduledAt).toBe(scheduledAt);
    expect(campaign.processedCount).toBe(0);

    await new Promise((resolve) => setImmediate(resolve));
    expect(sendSmsMock).not.toHaveBeenCalled();
    expect(db.data.messages).toHaveLength(0);
  });
});

describe('cancelScheduledCampaign', () => {
  it('marks a scheduled campaign as cancelled', async () => {
    db.data.campaigns.push({ id: 'camp-1', status: 'scheduled', scheduledAt: new Date(Date.now() + 60_000).toISOString() });

    const result = await cancelScheduledCampaign('camp-1');

    expect(result.ok).toBe(true);
    expect(result.campaign.status).toBe('cancelled');
    expect(db.data.campaigns[0].status).toBe('cancelled');
  });

  it('refuses to cancel a campaign that is not scheduled', async () => {
    db.data.campaigns.push({ id: 'camp-1', status: 'running' });

    const result = await cancelScheduledCampaign('camp-1');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_scheduled');
    expect(db.data.campaigns[0].status).toBe('running');
  });

  it('returns not_found for a missing campaign', async () => {
    const result = await cancelScheduledCampaign('missing');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_found');
  });
});

describe('runDueScheduledCampaigns', () => {
  it('starts a scheduled campaign whose time has arrived', async () => {
    const contact = addContact();
    const template = addTemplate();
    sendSmsMock.mockResolvedValue(undefined);

    db.data.campaigns.push({
      id: 'camp-1',
      templateId: template.id,
      channel: 'sms',
      contactIds: [contact.id],
      totalCount: 1,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: 'scheduled',
      scheduledAt: new Date(Date.now() - 1000).toISOString() // already due
    });

    await runDueScheduledCampaigns();
    // Flips to "running" synchronously; runCampaign itself is fire-and-forget.
    expect(db.data.campaigns[0].status).toBe('running');

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(db.data.campaigns[0].status).toBe('completed');
    expect(sendSmsMock).toHaveBeenCalled();
    expect(sendWebhookEventMock).toHaveBeenCalledWith('campaign.completed', expect.objectContaining({ id: 'camp-1' }));
  });

  it('leaves campaigns scheduled for the future untouched', async () => {
    db.data.campaigns.push({
      id: 'camp-1',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 60_000).toISOString()
    });

    await runDueScheduledCampaigns();

    expect(db.data.campaigns[0].status).toBe('scheduled');
  });

  it('ignores campaigns that are not in "scheduled" state', async () => {
    db.data.campaigns.push({ id: 'camp-1', status: 'cancelled', scheduledAt: new Date(Date.now() - 1000).toISOString() });

    await runDueScheduledCampaigns();

    expect(db.data.campaigns[0].status).toBe('cancelled');
  });
});
