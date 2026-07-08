import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();
vi.mock('twilio', () => ({
  default: vi.fn(() => ({ messages: { create: createMock } }))
}));

const { default: twilioProvider } = await import('../twilioProvider.js');
const { default: twilioFactory } = await import('twilio');

const CONFIG = { accountSid: 'ACxxx', authToken: 'token', fromNumber: '+15550001111' };

beforeEach(() => {
  createMock.mockReset();
  twilioFactory.mockClear();
});

describe('twilioProvider', () => {
  it('throws when config is incomplete', async () => {
    await expect(twilioProvider.send('11988887777', 'oi', {})).rejects.toThrow(
      /configuração do twilio incompleta/i
    );
    expect(twilioFactory).not.toHaveBeenCalled();
  });

  it('creates a Twilio client with the configured credentials and sends the message', async () => {
    createMock.mockResolvedValue({ sid: 'SM123' });

    const result = await twilioProvider.send('11988887777', 'Ola', CONFIG);

    expect(twilioFactory).toHaveBeenCalledWith(CONFIG.accountSid, CONFIG.authToken);
    expect(createMock).toHaveBeenCalledWith({
      body: 'Ola',
      from: CONFIG.fromNumber,
      to: '11988887777'
    });
    expect(result).toEqual({ providerMessageId: 'SM123' });
  });

  it('propagates errors thrown by the Twilio SDK', async () => {
    createMock.mockRejectedValue(new Error('Invalid number'));
    await expect(twilioProvider.send('123', 'oi', CONFIG)).rejects.toThrow('Invalid number');
  });
});
