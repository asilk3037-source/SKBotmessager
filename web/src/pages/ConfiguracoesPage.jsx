import { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';

const STATUS_LABELS = {
  disconnected: { text: 'Desconectado', className: 'badge-neutral' },
  connecting: { text: 'Conectando...', className: 'badge-warning' },
  qr: { text: 'Aguardando leitura do QR code', className: 'badge-warning' },
  connected: { text: 'Conectado', className: 'badge-success' },
};

export default function ConfiguracoesPage() {
  const [waStatus, setWaStatus] = useState(null);
  const [smsProviders, setSmsProviders] = useState([]);
  const [smsSettings, setSmsSettings] = useState(null);
  const [emailSettings, setEmailSettings] = useState(null);
  const [delayMs, setDelayMs] = useState(3000);
  const [savingSection, setSavingSection] = useState('');
  const [savedSection, setSavedSection] = useState('');
  const pollRef = useRef(null);

  async function loadWaStatus() {
    const status = await api.getWhatsappStatus();
    setWaStatus(status);
  }

  async function loadSettings() {
    const data = await api.getSettings();
    setSmsProviders(data.smsProviders);
    setSmsSettings(data.settings.sms);
    setEmailSettings(data.settings.email);
    setDelayMs(data.settings.delayBetweenMessagesMs);
  }

  useEffect(() => {
    loadWaStatus();
    loadSettings();
  }, []);

  useEffect(() => {
    if (waStatus && (waStatus.status === 'qr' || waStatus.status === 'connecting')) {
      pollRef.current = setInterval(loadWaStatus, 2000);
      return () => clearInterval(pollRef.current);
    }
  }, [waStatus?.status]);

  async function handleConnect() {
    const status = await api.connectWhatsapp();
    setWaStatus(status);
  }

  async function handleLogout() {
    if (!confirm('Desconectar o WhatsApp?')) return;
    const status = await api.logoutWhatsapp();
    setWaStatus(status);
  }

  async function saveSection(section, payload) {
    setSavingSection(section);
    setSavedSection('');
    try {
      await api.updateSettings(payload);
      setSavedSection(section);
    } finally {
      setSavingSection('');
    }
  }

  const provider = smsProviders.find((p) => p.id === smsSettings?.provider);
  const statusInfo = waStatus ? STATUS_LABELS[waStatus.status] : null;

  return (
    <div>
      <h1 className="page-title">Configurações</h1>
      <p className="page-subtitle">Conecte o WhatsApp e configure os canais de SMS e email.</p>

      <div className="card">
        <h3>WhatsApp</h3>
        {statusInfo && (
          <p>
            Status: <span className={`badge ${statusInfo.className}`}>{statusInfo.text}</span>
            {waStatus.connectedNumber && ` — número conectado: ${waStatus.connectedNumber}`}
          </p>
        )}

        {waStatus?.status === 'qr' && waStatus.qrDataUrl && (
          <div>
            <p className="helper-text">Abra o WhatsApp no seu celular → Mais opções → Aparelhos conectados → Conectar um aparelho, e escaneie o código abaixo.</p>
            <img src={waStatus.qrDataUrl} alt="QR Code WhatsApp" style={{ width: 220, height: 220 }} />
          </div>
        )}

        {waStatus?.error && (
          <div className="alert alert-error">Falha ao conectar: {waStatus.error}</div>
        )}

        <div className="toolbar">
          {(!waStatus || waStatus.status === 'disconnected') && (
            <button className="btn" onClick={handleConnect}>Conectar WhatsApp</button>
          )}
          {waStatus?.status === 'connected' && (
            <button className="btn btn-danger" onClick={handleLogout}>Desconectar</button>
          )}
        </div>
        <p className="helper-text">
          Essa integração usa seu WhatsApp pessoal/comercial via QR code (como o WhatsApp Web), não é a API oficial da Meta.
          Evite disparos muito grandes ou muito rápidos para reduzir o risco de bloqueio pelo WhatsApp.
        </p>
      </div>

      {smsSettings && (
        <form
          className="card"
          onSubmit={(e) => { e.preventDefault(); saveSection('sms', { sms: smsSettings }); }}
        >
          <h3>SMS</h3>
          <div className="field">
            <label htmlFor="sms-provider">Provedor de SMS</label>
            <select
              id="sms-provider"
              value={smsSettings.provider}
              onChange={(e) => setSmsSettings((s) => ({ ...s, provider: e.target.value }))}
            >
              {smsProviders.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          {provider?.id === 'twilio' && (
            <>
              <div className="row">
                <div className="field">
                  <label>Account SID</label>
                  <input
                    type="text"
                    value={smsSettings.accountSid || ''}
                    onChange={(e) => setSmsSettings((s) => ({ ...s, accountSid: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Auth Token</label>
                  <input
                    type="password"
                    value={smsSettings.authToken || ''}
                    onChange={(e) => setSmsSettings((s) => ({ ...s, authToken: e.target.value }))}
                  />
                </div>
              </div>
              <div className="field">
                <label>Número de origem (formato E.164, ex: +15017122661)</label>
                <input
                  type="text"
                  value={smsSettings.fromNumber || ''}
                  onChange={(e) => setSmsSettings((s) => ({ ...s, fromNumber: e.target.value }))}
                />
              </div>
              <p className="helper-text">
                Crie uma conta gratuita em twilio.com para obter essas credenciais e um número de teste.
              </p>
            </>
          )}

          {provider?.id === 'mock' && (
            <div className="alert alert-info">
              Modo simulado: as mensagens não são enviadas de verdade, apenas registradas no relatório.
              Use para testar o fluxo completo antes de configurar um provedor real.
            </div>
          )}

          {provider?.id === 'androidGateway' && (
            <>
              <div className="alert alert-info">
                Envia SMS de verdade pelo chip do seu próprio celular, usando o app grátis{' '}
                <strong>SMS Gateway for Android</strong> (sms-gate.app). Instale o app no celular com o chip
                que você quer usar, abra-o e copie a URL, o usuário e a senha mostrados na tela dele pra cá.
              </div>
              <div className="field">
                <label htmlFor="android-base-url">URL do serviço</label>
                <input
                  id="android-base-url"
                  type="text"
                  placeholder="http://192.168.0.10:8080 ou https://api.sms-gate.app/3rdparty/v1"
                  value={smsSettings.baseUrl || ''}
                  onChange={(e) => setSmsSettings((s) => ({ ...s, baseUrl: e.target.value }))}
                />
                <p className="helper-text">
                  Endereço local do celular na sua rede Wi-Fi (mais rápido) ou o relay em nuvem gratuito do
                  próprio app, se o celular não estiver na mesma rede.
                </p>
              </div>
              <div className="row">
                <div className="field">
                  <label htmlFor="android-login">Usuário</label>
                  <input
                    id="android-login"
                    type="text"
                    value={smsSettings.login || ''}
                    onChange={(e) => setSmsSettings((s) => ({ ...s, login: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="android-password">Senha</label>
                  <input
                    id="android-password"
                    type="password"
                    value={smsSettings.password || ''}
                    onChange={(e) => setSmsSettings((s) => ({ ...s, password: e.target.value }))}
                  />
                </div>
              </div>
              <p className="helper-text">
                O celular precisa ficar ligado, com o app aberto e conectado à internet enquanto os disparos
                acontecem.
              </p>
            </>
          )}

          <div className="toolbar">
            {savedSection === 'sms' && <span className="helper-text">Configurações salvas.</span>}
            <button type="submit" className="btn" disabled={savingSection === 'sms'}>
              {savingSection === 'sms' ? 'Salvando...' : 'Salvar SMS'}
            </button>
          </div>
        </form>
      )}

      {emailSettings && (
        <form
          className="card"
          onSubmit={(e) => { e.preventDefault(); saveSection('email', { email: emailSettings }); }}
        >
          <h3>Email</h3>
          <p className="helper-text">
            Envia usando sua própria conta do Gmail (grátis, até ~500 emails por dia). Você precisa gerar uma
            "senha de app" em myaccount.google.com/apppasswords — não use a senha normal da sua conta Google.
          </p>
          <div className="row">
            <div className="field">
              <label htmlFor="email-user">Seu Gmail</label>
              <input
                id="email-user"
                type="text"
                placeholder="voce@gmail.com"
                value={emailSettings.user || ''}
                onChange={(e) => setEmailSettings((s) => ({ ...s, user: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="email-app-password">Senha de app</label>
              <input
                id="email-app-password"
                type="password"
                placeholder="16 caracteres"
                value={emailSettings.appPassword || ''}
                onChange={(e) => setEmailSettings((s) => ({ ...s, appPassword: e.target.value }))}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="email-from-name">Nome de exibição (opcional)</label>
            <input
              id="email-from-name"
              type="text"
              placeholder="Ex: Sua Empresa"
              value={emailSettings.fromName || ''}
              onChange={(e) => setEmailSettings((s) => ({ ...s, fromName: e.target.value }))}
            />
          </div>

          <div className="toolbar">
            {savedSection === 'email' && <span className="helper-text">Configurações salvas.</span>}
            <button type="submit" className="btn" disabled={savingSection === 'email'}>
              {savingSection === 'email' ? 'Salvando...' : 'Salvar email'}
            </button>
          </div>
        </form>
      )}

      <form
        className="card"
        onSubmit={(e) => { e.preventDefault(); saveSection('delay', { delayBetweenMessagesMs: Number(delayMs) }); }}
      >
        <h3>Ritmo de envio</h3>
        <div className="field">
          <label htmlFor="delay-ms">Intervalo entre mensagens (milissegundos)</label>
          <input
            id="delay-ms"
            type="number"
            min="500"
            step="500"
            value={delayMs}
            onChange={(e) => setDelayMs(e.target.value)}
          />
          <p className="helper-text">Vale para WhatsApp, SMS e email. Intervalos maiores reduzem o risco de bloqueio.</p>
        </div>
        <div className="toolbar">
          {savedSection === 'delay' && <span className="helper-text">Configurações salvas.</span>}
          <button type="submit" className="btn" disabled={savingSection === 'delay'}>
            {savingSection === 'delay' ? 'Salvando...' : 'Salvar ritmo de envio'}
          </button>
        </div>
      </form>
    </div>
  );
}
