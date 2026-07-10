import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { CHANNEL_LABELS } from '../constants.js';
import Pagination from '../components/Pagination.jsx';
import TableSkeleton from '../components/TableSkeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

const ACTION_LABELS = {
  'contacts.import': 'Importação de contatos',
  'contacts.delete': 'Contato removido',
  'batches.delete': 'Lote removido',
  'templates.create': 'Template criado',
  'templates.update': 'Template atualizado',
  'templates.delete': 'Template removido',
  'campaigns.start': 'Disparo iniciado',
  'campaigns.schedule': 'Disparo agendado',
  'campaigns.cancel': 'Agendamento cancelado',
  'settings.update': 'Configurações alteradas',
  'whatsapp.connect': 'WhatsApp conectado',
  'whatsapp.logout': 'WhatsApp desconectado'
};

function describeEntry(entry) {
  const m = entry.meta || {};
  switch (entry.action) {
    case 'contacts.import':
      return `${m.importedCount ?? 0} importado(s), ${m.skippedCount ?? 0} ignorado(s)${m.label ? ` — ${m.label}` : ''}`;
    case 'contacts.delete':
      return m.name ? `Contato: ${m.name}` : '';
    case 'batches.delete':
      return `${m.removedContacts ?? 0} contato(s) removido(s)${m.label ? ` — ${m.label}` : ''}`;
    case 'templates.create':
    case 'templates.update':
    case 'templates.delete':
      return m.name ? `Template: ${m.name}` : '';
    case 'campaigns.start':
      return `${m.name ?? ''} — ${m.totalCount ?? 0} contato(s) via ${CHANNEL_LABELS[m.channel] ?? m.channel ?? ''}`;
    case 'campaigns.schedule':
      return `${m.name ?? ''} — agendado para ${m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('pt-BR') : '—'}`;
    case 'campaigns.cancel':
      return m.name ?? '';
    case 'settings.update':
      return `Seções: ${(m.sections || []).join(', ')}`;
    default:
      return '';
  }
}

const PAGE_SIZE = 50;

export default function AuditoriaPage() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, pageSize: PAGE_SIZE };
      if (action) params.action = action;
      const data = await api.listAuditLog(params);
      setEntries(data.entries);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => { setPage(1); }, [action]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 className="page-title">Auditoria</h1>
      <p className="page-subtitle">Histórico de ações realizadas no sistema: importações, disparos, alterações de configuração e mais.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="toolbar">
          <div className="row" style={{ maxWidth: 320 }}>
            <select aria-label="Filtrar por ação" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Todas as ações</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <>
            <span className="sr-only">Carregando...</span>
            <TableSkeleton rows={8} columns={3} />
          </>
        ) : entries.length === 0 ? (
          <EmptyState icon="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-5 8 2 2 4-4">
            Nenhuma ação registrada ainda.
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Ação</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.createdAt).toLocaleString('pt-BR')}</td>
                    <td>{ACTION_LABELS[e.action] ?? e.action}</td>
                    <td className="helper-text">{describeEntry(e)}</td>
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
