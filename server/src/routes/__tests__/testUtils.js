import db from '../../db/index.js';

export async function resetDb() {
  db.data.contacts = [];
  db.data.batches = [];
  db.data.templates = [];
  db.data.campaigns = [];
  db.data.messages = [];
  db.data.settings.sms = {
    provider: 'twilio',
    accountSid: '',
    authToken: '',
    fromNumber: '',
    baseUrl: 'https://api.sms-gate.app/3rdparty/v1',
    login: '',
    password: ''
  };
  db.data.settings.email = { user: '', appPassword: '', fromName: '' };
  db.data.settings.delayBetweenMessagesMs = 3000;
  db.data.settings.webhookUrl = '';
  await db.write();
}
