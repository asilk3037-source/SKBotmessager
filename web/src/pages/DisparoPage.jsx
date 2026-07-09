import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

function renderPreview(content, contact) {
  return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, rawKey) => {
    const key = rawKey.trim().toLowerCase();
    if (key === 'nome') return contact.name ?? '';
    if (key === 'telefone') return contact.phone ?? '';
    const extraKey = Object.keys(contact.extras || {}).find((k) => k.toLowerCase() === key);
    if (extraKey) return String(contact.extras[extraKey] ?? '');
    return match;
  });
}

function getRecipient(channel, contact) {
  return channel === 'email' ? contact.email : contact.phone;
}

const CHANNEL_LABELS = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email' };

export default function DisparoPage() {
  const [batches, setBatches] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [channel, setChannel] = useState('whatsapp');
  const [templateId, setTemplateId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    api.listBatches().then(setBatches).catch((err) => setError(err.message));
    api.listTemplates().then(setTemplates).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedBatch) { setContacts([]); return; }
    // Guards against a slower response for a previously selected batch
    // resolving after a newer one and overwriting the contact list with
    // the wrong batch's data.
    let cancelled = false;
    api.listContacts({ batchId: selectedBatch }).then((data) => {
      if (cancelled) return;
      setContacts(data.contacts);
      setSelectedIds(new Set(data.contacts.map((c) => c.id)));
    }).catch((err) => {
      if (!cancelled) setError(err.message);
    });
    return () => { cancelled = true; };
  }, [selectedBatch]);

  const filteredTemplates = useMemo(
    () => templates.filter((t) => t.channel === channel || t.channel === 'any'),
    [templates, channel]
  );

  useEffect(() => {
    if (filteredTemplates.length === 0) { setTemplateId(''); return; }
    const current = filteredTemplates.find((t) => t.id === templateId);
    if (!current) {
      const def = filteredTemplates.find((t) => t.isDefault) || filteredTemplates[0];
      setTemplateId(def.id);
    }
  }, [filteredTemplates, templateId]);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const selectedContacts = contacts.filter((c) => selectedIds.has(c.id));
  const selectedWithoutRecipient = selectedContacts.filter((c) => !getRecipient(channel, c));

  function toggleContact(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id))
    );
  }

  async function handleStart() {
    if (!templateId || selectedContacts.length === 0) return;
    setError('');
    setStarting(true);
    try {
      const created = await api.createCampaign({
        name: campaignName || `Disparo ${new Date().toLocaleString('pt-BR')}`,
        templateId,
        channel,
        contactIds: [...selectedIds],
      });
      setCampaign(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (!campaign || campaign.status !== 'running') {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const updated = await api.getCampaign(campaign.id);
        setCampaign(updated);
        if (updated.status !== 'running') clearInterval(pollRef.current);
      } catch (err) {
        setError(err.message);
      }
    }, 1500);
    return () => clearInterval(pollRef.current);
  }, [campaign?.id, campaign?.status]);

  if (campaign) {
    const pct = campaign.totalCount ? Math.round((campaign.processedCount / campaign.totalCount) * 100) : 0;
    return (
      <div>
        <h1 className="page-title">Disparo em andamento</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="card">
          <h3>{campaign.name}</h3>
          <div className="progress-bar" style={{ marginBottom: 10 }}>
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <p>{campaign.processedCount} de {campaign.totalCount} processados ({pct}%)</p>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{campaign.sentCount}</div>
              <div className="stat-label">Enviadas</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{campaign.failedCount}</div>
              <div className="stat-label">Falharam</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {campaign.status === 'running' ? 'Em andamento' : campaign.status === 'completed' ? 'Concluído' : 'Erro'}
              </div>
              <div className="stat-label">Status</div>
            </div>
          </div>
          {campaign.status !== 'running' && (
            <div className="toolbar">
              <button className="btn btn-secondary" onClick={() => setCampaign(null)}>Novo disparo</button>
              <Link className="btn" to="/relatorios">Ver relatório completo</Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Disparo em massa</h1>
      <p className="page-subtitle">Selecione os contatos, escolha o canal e a mensagem, e dispare.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>1. Escolha o lote de contatos</h3>
        <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
          <option value="">Selecione um lote importado...</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.label} ({b.importedCount} contatos)</option>)}
        </select>
        {batches.length === 0 && (
          <p className="helper-text">Nenhum lote importado. <Link to="/upload">Importe uma planilha primeiro</Link>.</p>
        )}
      </div>

      {selectedBatch && contacts.length > 0 && (
        <div className="card">
          <div className="toolbar">
            <h3 style={{ margin: 0 }}>2. Selecione os contatos ({selectedIds.size} de {contacts.length})</h3>
            <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
              {selectedIds.size === contacts.length ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table>
              <tbody>
                {contacts.map((c) => {
                  const recipient = getRecipient(channel, c);
                  return (
                    <tr key={c.id}>
                      <td style={{ width: 30 }}>
                        <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleContact(c.id)} />
                      </td>
                      <td>{c.name}</td>
                      <td>
                        {recipient || (
                          <span className="badge badge-warning">Sem {channel === 'email' ? 'email' : 'telefone'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedBatch && (
        <div className="card">
          <h3>3. Canal e mensagem</h3>
          <div className="row">
            <div className="field">
              <label htmlFor="disparo-channel">Canal de envio</label>
              <select id="disparo-channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="disparo-template">Template de mensagem</label>
              <select id="disparo-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {filteredTemplates.length === 0 && <option value="">Nenhum template disponível</option>}
                {filteredTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {filteredTemplates.length === 0 && (
                <p className="helper-text"><Link to="/templates">Crie um template</Link> para este canal.</p>
              )}
            </div>
          </div>
          <div className="field">
            <label htmlFor="campaign-name">Nome da campanha (opcional, aparece no relatório)</label>
            <input
              id="campaign-name"
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>
        </div>
      )}

      {selectedTemplate && selectedContacts.length > 0 && (
        <div className="card">
          <h3>4. Pré-visualização</h3>
          <p className="helper-text">Exemplo de como a mensagem chegará para {selectedContacts.length} contato(s) selecionado(s):</p>
          {selectedContacts.filter((c) => getRecipient(channel, c)).slice(0, 3).map((c) => (
            <div key={c.id} className="alert alert-info" style={{ whiteSpace: 'pre-wrap' }}>
              <strong>{c.name} ({getRecipient(channel, c)}):</strong>
              {selectedTemplate.channel !== 'sms' && selectedTemplate.subject && channel === 'email' && (
                <><br /><em>Assunto: {renderPreview(selectedTemplate.subject, c)}</em></>
              )}
              <br />
              {renderPreview(selectedTemplate.content, c)}
            </div>
          ))}

          {selectedWithoutRecipient.length > 0 && (
            <div className="alert alert-error">
              {selectedWithoutRecipient.length} contato(s) selecionado(s) sem {channel === 'email' ? 'email' : 'telefone'} cadastrado
              — serão marcados como falha no relatório e não recebem a mensagem.
            </div>
          )}

          <div className="toolbar">
            <span className="helper-text">
              O envio será feito um por um, com intervalo entre mensagens (configurável em Configurações).
            </span>
            <button className="btn" onClick={handleStart} disabled={starting}>
              {starting ? 'Iniciando...' : `Disparar para ${selectedContacts.length} contato(s) por ${CHANNEL_LABELS[channel]}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
