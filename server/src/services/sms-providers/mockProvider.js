// Fake provider that always "succeeds" without sending anything real.
// Useful to test the whole flow (upload -> template -> disparo -> relatório) before
// paying for a real SMS gateway.
export default {
  id: 'mock',
  label: 'Simulado (teste, não envia de verdade)',
  requiredFields: [],

  async send(phone, text) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { providerMessageId: `mock_${Date.now()}` };
  }
};
