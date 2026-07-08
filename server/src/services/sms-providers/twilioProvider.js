import twilio from 'twilio';

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
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      body: text,
      from: fromNumber,
      to: phone
    });
    return { providerMessageId: message.sid };
  }
};
