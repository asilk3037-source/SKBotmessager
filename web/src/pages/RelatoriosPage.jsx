import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { CHANNEL_LABELS } from '../constants.js';
import Pagination from '../components/Pagination.jsx';
import TableSkeleton from '../components/TableSkeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

const STATUS_BADGE = {
  sent: <span className="badge badge-success">Enviada</span>,
  failed: <span className="badge badge-danger">Falhou</span>,
  pending: <span className="badge badge-warning">Pendente</span>,
};

const PAGE_SIZE = 50;

export default function RelatoriosPage() {
  const [summary, setSummary] = useState(null);
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ channel: '', status: '', campaignId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const [summaryData, messagesData] = await Promise.all([
        api.reportSummary(),
        api.listMessages({ ...activeFilters, page, pageSize: PAGE_SIZE }),
      ]);
      setSummary(summaryData);
      setMessages(messagesData.messages);
      setTotal(messagesData.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Changing a filter should always jump back to page 1, same reasoning as
  // Contatos: staying on a later page of a now-shorter filtered list would
  // show an empty page with no explanation.
  useEffect(() => { setPage(1); }, [filters]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 className="page-title">Relatórios</h1>
      <p className="page-subtitle">Histórico completo de mensagens enviadas, com status e detalhes.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {summary ? (
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
      ) : loading && (
        <div className="skeleton-stat-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-stat-card">
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ))}
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
          <>
            <span className="sr-only">Carregando...</span>
            <TableSkeleton rows={6} columns={6} />
          </>
        ) : messages.length === 0 ? (
          <EmptyState icon="M4 20V10m6 10V4m6 16v-7">
            Nenhum envio encontrado com esses filtros.
          </EmptyState>
        ) : (
          <div className="table-scroll">
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
                  <tr key={m.id} className={m.status === 'failed' ? 'row-danger' : m.status === 'pending' ? 'row-warning' : ''}>
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
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </div>
  );
}
