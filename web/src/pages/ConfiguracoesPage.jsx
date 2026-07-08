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
  const [delayMs, setDelayMs] = useState(3000);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const pollRef = useRef(null);

  async function loadWaStatus() {
    const status = await api.getWhatsappStatus();
    setWaStatus(status);
  }

  async function loadSettings() {
    const data = await api.getSettings();
    setSmsProviders(data.smsProviders);
    setSmsSettings(data.settings.sms);
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

  async function handleSaveSms(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings({ sms: smsSettings, delayBetweenMessagesMs: Number(delayMs) });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const provider = smsProviders.find((p) => p.id === smsSettings?.provider);
  const statusInfo = waStatus ? STATUS_LABELS[waStatus.status] : null;

  return (
    <div>
      <h1 className="page-title">Configurações</h1>
      <p className="page-subtitle">Conecte o WhatsApp, configure o provedor de SMS e o ritmo de envio.</p>

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
        <form className="card" onSubmit={handleSaveSms}>
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

          <div className="field">
            <label>Intervalo entre mensagens (milissegundos)</label>
            <input
              type="number"
              min="500"
              step="500"
              value={delayMs}
              onChange={(e) => setDelayMs(e.target.value)}
            />
            <p className="helper-text">Vale para WhatsApp e SMS. Intervalos maiores reduzem o risco de bloqueio.</p>
          </div>

          <div className="toolbar">
            {saved && <span className="helper-text">Configurações salvas.</span>}
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
