import db from '../db/index.js';
import twilioProvider from './sms-providers/twilioProvider.js';
import mockProvider from './sms-providers/mockProvider.js';

const providers = {
  [twilioProvider.id]: twilioProvider,
  [mockProvider.id]: mockProvider
};

export function listProviders() {
  return Object.values(providers).map((p) => ({
    id: p.id,
    label: p.label,
    requiredFields: p.requiredFields
  }));
}

export async function sendSms(phone, text) {
  const settings = db.data.settings.sms;
  const provider = providers[settings.provider];
  if (!provider) {
    throw new Error(`Provedor de SMS "${settings.provider}" desconhecido.`);
  }
  return provider.send(phone, text, settings);
}
