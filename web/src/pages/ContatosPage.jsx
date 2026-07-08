import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ContatosPage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBatches = useCallback(async () => {
    const data = await api.listBatches();
    setBatches(data);
  }, []);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (selectedBatch) params.batchId = selectedBatch;
      if (search) params.search = search;
      const data = await api.listContacts(params);
      setContacts(data.contacts);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedBatch, search]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => {
    const t = setTimeout(loadContacts, 250);
    return () => clearTimeout(t);
  }, [loadContacts]);

  async function handleDeleteContact(id) {
    if (!confirm('Remover este contato?')) return;
    await api.deleteContact(id);
    loadContacts();
  }

  async function handleDeleteBatch(batchId) {
    if (!confirm('Remover este lote e todos os contatos importados nele?')) return;
    await api.deleteBatch(batchId);
    if (selectedBatch === batchId) setSelectedBatch('');
    loadBatches();
    loadContacts();
  }

  return (
    <div>
      <h1 className="page-title">Contatos</h1>
      <p className="page-subtitle">Contatos importados das suas planilhas, prontos para disparo.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {batches.length === 0 && !loading ? (
        <div className="card empty-state">
          Nenhum contato importado ainda. <Link to="/upload">Importe uma planilha</Link> para começar.
        </div>
      ) : (
        <>
          <div className="card">
            <h3>Lotes importados</h3>
            <table>
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Importados</th>
                  <th>Ignorados</th>
                  <th>Data</th>
                  <th></th>
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

          <div className="card">
            <div className="toolbar">
              <h3 style={{ margin: 0 }}>Todos os contatos ({total})</h3>
              <div className="row" style={{ maxWidth: 480 }}>
                <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                  <option value="">Todos os lotes</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                <input
                  type="search"
                  placeholder="Buscar por nome, telefone ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {contacts.length === 0 ? (
              <div className="empty-state">Nenhum contato encontrado.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Email</th>
                    <th>Dados extras</th>
                    <th></th>
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
