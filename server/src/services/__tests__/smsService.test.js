import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();
vi.mock('twilio', () => ({
  default: vi.fn(() => ({ messages: { create: createMock } }))
}));

const db = (await import('../../db/index.js')).default;
const { listProviders, sendSms } = await import('../smsService.js');

beforeEach(() => {
  createMock.mockReset();
  db.data.settings.sms = {
    provider: 'mock',
    accountSid: '',
    authToken: '',
    fromNumber: '',
    baseUrl: '',
    login: '',
    password: ''
  };
});

describe('listProviders', () => {
  it('lists twilio, mock and androidGateway with their required fields', () => {
    const providers = listProviders();
    const ids = providers.map((p) => p.id);
    expect(ids).toEqual(['twilio', 'mock', 'androidGateway']);

    const twilio = providers.find((p) => p.id === 'twilio');
    expect(twilio.requiredFields).toEqual(['accountSid', 'authToken', 'fromNumber']);
  });
});

describe('sendSms', () => {
  it('dispatches to the mock provider when that is configured', async () => {
    db.data.settings.sms.provider = 'mock';
    const result = await sendSms('11988887777', 'oi');
    expect(result.providerMessageId).toMatch(/^mock_/);
  });

  it('dispatches to the twilio provider with the settings stored in the db', async () => {
    createMock.mockResolvedValue({ sid: 'SM999' });
    db.data.settings.sms = {
      ...db.data.settings.sms,
      provider: 'twilio',
      accountSid: 'ACxxx',
      authToken: 'tok',
      fromNumber: '+15550001111'
    };

    const result = await sendSms('11988887777', 'oi');

    expect(createMock).toHaveBeenCalledWith({ body: 'oi', from: '+15550001111', to: '11988887777' });
    expect(result).toEqual({ providerMessageId: 'SM999' });
  });

  it('throws a clear error for an unknown provider id', async () => {
    db.data.settings.sms.provider = 'does-not-exist';
    await expect(sendSms('123', 'oi')).rejects.toThrow(/desconhecido/i);
  });
});
