// Sends SMS through a phone's own SIM/plan via the "SMS Gateway for Android" app
// (https://sms-gate.app). The app runs an HTTP API - either locally on the phone's
// network, or relayed through the project's free cloud endpoint - and this just
// calls that API with whatever URL/credentials the app shows on screen.
export default {
  id: 'androidGateway',
  label: 'Celular Android (SMS Gateway)',
  requiredFields: ['baseUrl', 'login', 'password'],

  async send(phone, text, config) {
    const { baseUrl, login, password } = config;
    if (!baseUrl || !login || !password) {
      throw new Error(
        'Configuração do Android Gateway incompleta. Preencha URL, usuário e senha em Configurações.'
      );
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/message`;
    const auth = Buffer.from(`${login}:${password}`).toString('base64');

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`
        },
        body: JSON.stringify({
          phoneNumbers: [phone],
          textMessage: { text }
        }),
        signal: AbortSignal.timeout(15000)
      });
    } catch (err) {
      throw new Error(`Não foi possível conectar ao celular: ${err.message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Android Gateway respondeu ${res.status}: ${body || res.statusText}`);
    }

    const data = await res.json();
    return { providerMessageId: data.id };
  }
};
