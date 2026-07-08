import nodemailer from 'nodemailer';
import db from '../db/index.js';

let cachedTransporter = null;
let cachedKey = null;

function getTransporter(settings) {
  const key = `${settings.user}:${settings.appPassword}`;
  if (cachedTransporter && cachedKey === key) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: settings.user, pass: settings.appPassword },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000
  });
  cachedKey = key;
  return cachedTransporter;
}

export async function sendEmail(to, subject, text) {
  const settings = db.data.settings.email;
  if (!settings?.user || !settings?.appPassword) {
    throw new Error('Configuração de e-mail incompleta. Preencha seu Gmail e a senha de app em Configurações.');
  }

  const transporter = getTransporter(settings);
  const fromName = settings.fromName?.trim();
  const from = fromName ? `"${fromName}" <${settings.user}>` : settings.user;

  const info = await transporter.sendMail({
    from,
    to,
    subject: subject || '(sem assunto)',
    text
  });

  return { providerMessageId: info.messageId };
}
