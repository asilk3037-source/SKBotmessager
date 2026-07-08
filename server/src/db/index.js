import { JSONFilePreset } from 'lowdb/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, '..', '..', 'data', 'db.json');

const defaultData = {
  contacts: [],
  batches: [],
  templates: [],
  campaigns: [],
  messages: [],
  settings: {
    sms: {
      provider: 'twilio',
      accountSid: '',
      authToken: '',
      fromNumber: ''
    },
    delayBetweenMessagesMs: 3000
  }
};

const db = await JSONFilePreset(DB_FILE, defaultData);

// Backfill defaults if db.json already existed without newer fields
db.data.contacts ??= [];
db.data.batches ??= [];
db.data.templates ??= [];
db.data.campaigns ??= [];
db.data.messages ??= [];
db.data.settings ??= defaultData.settings;
db.data.settings.sms ??= defaultData.settings.sms;
db.data.settings.delayBetweenMessagesMs ??= defaultData.settings.delayBetweenMessagesMs;
await db.write();

export default db;
