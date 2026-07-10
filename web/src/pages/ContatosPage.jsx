import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Pagination from '../components/Pagination.jsx';
import TableSkeleton from '../components/TableSkeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const PAGE_SIZE = 50;

export default function ContatosPage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmState, setConfirmState] = useState(null);
  const requestIdRef = useRef(0);
  const showToast = useToast();

  const loadBatches = useCallback(async () => {
    try {
      const data = await api.listBatches();
      setBatches(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    // Tags each call with an id so a slower, older request (e.g. from a
    // previous keystroke) can't overwrite the list with stale results once a
    // newer one has already resolved.
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const params = { page, pageSize: PAGE_SIZE };
      if (selectedBatch) params.batchId = selectedBatch;
      if (search) params.search = search;
      const data = await api.listContacts(params);
      if (requestId !== requestIdRef.current) return;
      setContacts(data.contacts);
      setTotal(data.total);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [selectedBatch, search, page]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  // Changing the batch/search filter should always jump back to page 1 -
  // staying on, say, page 5 of a now much shorter filtered list would show
  // an empty page with no obvious explanation.
  useEffect(() => { setPage(1); }, [selectedBatch, search]);
  useEffect(() => {
    const t = setTimeout(loadContacts, 250);
    return () => clearTimeout(t);
  }, [loadContacts]);

  function handleDeleteContact(id) {
    setConfirmState({
      message: 'Remover este contato?',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.deleteContact(id);
          loadContacts();
          showToast('Contato removido.');
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  function handleDeleteBatch(batchId) {
    setConfirmState({
      message: 'Remover este lote e todos os contatos importados nele?',
      onConfirm: () => confirmDeleteBatch(batchId),
    });
  }

  async function confirmDeleteBatch(batchId) {
    setConfirmState(null);
    try {
      await api.deleteBatch(batchId);
      if (selectedBatch === batchId) setSelectedBatch('');
      loadBatches();
      loadContacts();
      showToast('Lote removido.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">Contatos</h1>
      <p className="page-subtitle">Contatos importados das suas planilhas, prontos para disparo.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {batches.length === 0 && !loading ? (
        <div className="card">
          <EmptyState icon="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3">
            Nenhum contato importado ainda. <Link to="/upload">Importe uma planilha</Link> para começar.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="card">
            <h3>Lotes importados</h3>
            <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Importados</th>
                  <th>Ignorados</th>
                  <th>Data</th>
                  <th aria-label="Ações" data-tooltip="Ações"></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td>{b.label}</td>
                    <td>{b.importedCount}</td>
                    <td>{b.skippedCount}</td>
                    <td>{new Date(b.createdAt).toLocaleString('pt-BR')}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedBatch(b.id)}>
                        Filtrar
                      </button>{' '}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBatch(b.id)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="card">
            <div className="toolbar">
              <h3 style={{ margin: 0 }}>Todos os contatos ({total})</h3>
              <div className="row" style={{ maxWidth: 480 }}>
                <select aria-label="Filtrar por lote" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                  <option value="">Todos os lotes</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                <input
                  aria-label="Buscar contatos"
                  type="search"
                  placeholder="Buscar por nome, telefone ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {loading && contacts.length === 0 ? (
              <>
                <span className="sr-only">Carregando...</span>
                <TableSkeleton rows={6} columns={5} />
              </>
            ) : contacts.length === 0 ? (
              <EmptyState icon="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-5.6-5.6">
                Nenhum contato encontrado.
              </EmptyState>
            ) : (
              <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Email</th>
                    <th>Dados extras</th>
                    <th aria-label="Ações" data-tooltip="Ações"></th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.phone || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td>
                        {Object.entries(c.extras || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteContact(c.id)}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!confirmState}
        message={confirmState?.message}
        danger
        confirmLabel="Remover"
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
