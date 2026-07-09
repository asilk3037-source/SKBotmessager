import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { CHANNEL_LABELS } from '../constants.js';

const STATUS_BADGE = {
  sent: <span className="badge badge-success">Enviada</span>,
  failed: <span className="badge badge-danger">Falhou</span>,
  pending: <span className="badge badge-warning">Pendente</span>,
};

export default function RelatoriosPage() {
  const [summary, setSummary] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filters, setFilters] = useState({ channel: '', status: '', campaignId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryData, messagesData] = await Promise.all([
        api.reportSummary(),
        api.listMessages(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))),
      ]);
      setSummary(summaryData);
      setMessages(messagesData.messages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 className="page-title">Relatórios</h1>
      <p className="page-subtitle">Histórico completo de mensagens enviadas, com status e detalhes.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {summary && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{summary.totals.campaigns}</div>
            <div className="stat-label">Disparos realizados</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{summary.totals.messagesSent}</div>
            <div className="stat-label">Mensagens enviadas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{summary.totals.messagesFailed}</div>
            <div className="stat-label">Falhas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{summary.totals.messagesTotal}</div>
            <div className="stat-label">Total processado</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <div className="row" style={{ maxWidth: 520 }}>
            <select aria-label="Filtrar por campanha" value={filters.campaignId} onChange={(e) => setFilters((f) => ({ ...f, campaignId: e.target.value }))}>
              <option value="">Todas as campanhas</option>
              {summary?.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label="Filtrar por canal" value={filters.channel} onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}>
              <option value="">Todos os canais</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
            <select aria-label="Filtrar por status" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">Todos os status</option>
              <option value="sent">Enviada</option>
              <option value="failed">Falhou</option>
            </select>
          </div>
          <a
            className="btn btn-secondary"
            href={api.exportCsvUrl(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))}
          >
            Exportar CSV
          </a>
        </div>

        {loading ? (
          <p className="helper-text">Carregando...</p>
        ) : messages.length === 0 ? (
          <div className="empty-state">Nenhum envio encontrado com esses filtros.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Contato</th>
                  <th>Destinatário</th>
                  <th>Canal</th>
                  <th>Status</th>
                  <th>Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.createdAt).toLocaleString('pt-BR')}</td>
                    <td>{m.contactName}</td>
                    <td>{m.recipient || '—'}</td>
                    <td>{CHANNEL_LABELS[m.channel] ?? m.channel}</td>
                    <td>{STATUS_BADGE[m.status] || m.status}{m.error && <div className="helper-text">{m.error}</div>}</td>
                    <td style={{ maxWidth: 260, whiteSpace: 'pre-wrap' }}>
                      {m.subject && <strong>{m.subject}<br /></strong>}
                      {m.content}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
