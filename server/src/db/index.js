import { JSONFilePreset } from 'lowdb/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptSecret, decryptSecret } from '../services/secretCrypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Overridable so tests (and any other alternate deployment) never touch the real data file.
const DB_FILE = process.env.SKBOT_DB_FILE || path.join(__dirname, '..', '..', 'data', 'db.json');

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
      fromNumber: '',
      baseUrl: 'https://api.sms-gate.app/3rdparty/v1',
      login: '',
      password: ''
    },
    email: {
      user: '',
      appPassword: '',
      fromName: ''
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
db.data.settings.sms.baseUrl ??= defaultData.settings.sms.baseUrl;
db.data.settings.sms.login ??= defaultData.settings.sms.login;
db.data.settings.sms.password ??= defaultData.settings.sms.password;
db.data.settings.email ??= defaultData.settings.email;
db.data.settings.delayBetweenMessagesMs ??= defaultData.settings.delayBetweenMessagesMs;

// Secrets (Twilio authToken, Android Gateway password, Gmail app password)
// are encrypted at rest in db.json but always kept decrypted in `db.data`
// in memory - every existing call site (routes, providers) keeps reading
// plain values with no changes needed. Decrypt once on load...
db.data.settings.sms.authToken = decryptSecret(db.data.settings.sms.authToken);
db.data.settings.sms.password = decryptSecret(db.data.settings.sms.password);
db.data.settings.email.appPassword = decryptSecret(db.data.settings.email.appPassword);

// ...and re-encrypt only the snapshot handed to the adapter on every write,
// never `db.data` itself - so no request handler can ever observe an
// encrypted value in memory mid-write.
const rawAdapter = db.adapter;
db.write = async function writeWithEncryptedSecrets() {
  const { settings } = db.data;
  const snapshot = {
    ...db.data,
    settings: {
      ...settings,
      sms: { ...settings.sms, authToken: encryptSecret(settings.sms.authToken), password: encryptSecret(settings.sms.password) },
      email: { ...settings.email, appPassword: encryptSecret(settings.email.appPassword) }
    }
  };
  await rawAdapter.write(snapshot);
};

await db.write();

export default db;
