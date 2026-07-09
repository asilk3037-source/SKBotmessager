import twilio from 'twilio';

let cachedClient = null;
let cachedKey = null;

function getClient(accountSid, authToken) {
  const key = `${accountSid}:${authToken}`;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = twilio(accountSid, authToken);
  cachedKey = key;
  return cachedClient;
}

// Generic SMS provider contract: async send(phone, text, config) -> { providerMessageId }
export default {
  id: 'twilio',
  label: 'Twilio',
  requiredFields: ['accountSid', 'authToken', 'fromNumber'],

  async send(phone, text, config) {
    const { accountSid, authToken, fromNumber } = config;
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Configuração do Twilio incompleta. Preencha accountSid, authToken e fromNumber em Configurações.');
    }
    const client = getClient(accountSid, authToken);
    const message = await client.messages.create({
      body: text,
      from: fromNumber,
      to: phone
    });
    return { providerMessageId: message.sid };
  }
};
