import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMailMock = vi.fn();
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock }
}));

const db = (await import('../../db/index.js')).default;
const { sendEmail } = await import('../emailService.js');

// The transporter is cached by user+password inside emailService's module state (not reset
// between tests), so every test below uses its own unique credentials to avoid cache bleed.
let counter = 0;
function freshCreds(fromName = '') {
  counter += 1;
  return { user: `user${counter}@gmail.com`, appPassword: `pass${counter}`, fromName };
}

beforeEach(() => {
  sendMailMock.mockReset();
  createTransportMock.mockClear();
});

describe('sendEmail', () => {
  it('throws when Gmail credentials are missing', async () => {
    db.data.settings.email = { user: '', appPassword: '', fromName: '' };
    await expect(sendEmail('to@example.com', 'Assunto', 'corpo')).rejects.toThrow(
      /configuração de e-mail incompleta/i
    );
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it('sends with the configured Gmail account and returns the message id', async () => {
    const creds = freshCreds();
    db.data.settings.email = creds;
    sendMailMock.mockResolvedValue({ messageId: 'abc123' });

    const result = await sendEmail('to@example.com', 'Assunto', 'corpo');

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: creds.user, pass: creds.appPassword } })
    );
    expect(sendMailMock).toHaveBeenCalledWith({
      from: creds.user,
      to: 'to@example.com',
      subject: 'Assunto',
      text: 'corpo'
    });
    expect(result).toEqual({ providerMessageId: 'abc123' });
  });

  it('wraps the From address with the display name when configured', async () => {
    const creds = freshCreds('Minha Empresa');
    db.data.settings.email = creds;
    sendMailMock.mockResolvedValue({ messageId: 'x' });

    await sendEmail('to@example.com', 'Assunto', 'corpo');

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: `"Minha Empresa" <${creds.user}>` })
    );
  });

  it('falls back to a default subject when none is provided', async () => {
    db.data.settings.email = freshCreds();
    sendMailMock.mockResolvedValue({ messageId: 'x' });

    await sendEmail('to@example.com', '', 'corpo');

    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ subject: '(sem assunto)' }));
  });

  it('reuses the same transporter for repeated sends with the same credentials', async () => {
    db.data.settings.email = freshCreds();
    sendMailMock.mockResolvedValue({ messageId: 'x' });

    await sendEmail('a@example.com', 's', 'c');
    await sendEmail('b@example.com', 's', 'c');

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it('creates a new transporter when the credentials change', async () => {
    db.data.settings.email = freshCreds();
    sendMailMock.mockResolvedValue({ messageId: 'x' });
    await sendEmail('a@example.com', 's', 'c');

    db.data.settings.email = freshCreds();
    await sendEmail('a@example.com', 's', 'c');

    expect(createTransportMock).toHaveBeenCalledTimes(2);
  });

  it('propagates errors from the SMTP transport', async () => {
    db.data.settings.email = freshCreds();
    sendMailMock.mockRejectedValue(new Error('Connection timeout'));

    await expect(sendEmail('a@example.com', 's', 'c')).rejects.toThrow('Connection timeout');
  });
});
