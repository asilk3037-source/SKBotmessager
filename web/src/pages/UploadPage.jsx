import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [preview, setPreview] = useState(null);
  const [nameColumn, setNameColumn] = useState('');
  const [phoneColumn, setPhoneColumn] = useState('');
  const [emailColumn, setEmailColumn] = useState('');
  const [batchLabel, setBatchLabel] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [multiFileWarning, setMultiFileWarning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await api.previewSpreadsheet(file);
      if (data.rows.length === 0) {
        setError('A planilha está vazia ou não pôde ser lida.');
        setPreview(null);
      } else {
        setPreview(data);
        setNameColumn(data.suggestedNameColumn || data.columns[0] || '');
        setPhoneColumn(data.suggestedPhoneColumn || '');
        setEmailColumn(data.suggestedEmailColumn || '');
        setBatchLabel(data.fileName || '');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.importContacts({
        fileName: preview.fileName,
        rows: preview.rows,
        nameColumn,
        phoneColumn: phoneColumn || undefined,
        emailColumn: emailColumn || undefined,
        extraColumns: preview.columns,
        batchLabel,
      });
      setResult(res);
      setPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const canImport = nameColumn && (phoneColumn || emailColumn);

  return (
    <div>
      <h1 className="page-title">Importar planilha</h1>
      <p className="page-subtitle">
        Suba a planilha (.xlsx ou .csv) com os contatos que você normalmente usa para enviar mensagem manualmente.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {multiFileWarning && (
        <div className="alert alert-info">Apenas um arquivo por vez é suportado. Foi usado o primeiro.</div>
      )}

      {!preview && (
        <div className="card">
          <button
            type="button"
            className={`dropzone${dragOver ? ' dragover' : ''}`}
            aria-label="Escolher arquivo de planilha"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              setMultiFileWarning(e.dataTransfer.files?.length > 1);
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            {loading ? 'Lendo planilha...' : (
              <>
                <strong>Clique para escolher um arquivo</strong> ou arraste aqui
                <div className="helper-text">Formatos aceitos: .xlsx, .csv</div>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {preview && (
        <div className="card">
          <h3>Configurar importação</h3>
          <div className="field">
            <label htmlFor="batch-label">Nome deste lote</label>
            <input id="batch-label" type="text" value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="name-column">Coluna com o nome do contato</label>
              <select id="name-column" value={nameColumn} onChange={(e) => setNameColumn(e.target.value)}>
                {preview.columns.map((col) => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="phone-column">Coluna com o telefone (WhatsApp/SMS)</label>
              <select id="phone-column" value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)}>
                <option value="">Não usar</option>
                {preview.columns.map((col) => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="email-column">Coluna com o email</label>
              <select id="email-column" value={emailColumn} onChange={(e) => setEmailColumn(e.target.value)}>
                <option value="">Não usar</option>
                {preview.columns.map((col) => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
          </div>
          {!canImport && (
            <p className="helper-text">Selecione o nome e ao menos uma coluna (telefone ou email).</p>
          )}

          <p className="helper-text">
            {preview.rows.length} linha(s) encontradas. Pré-visualização das 5 primeiras:
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>{preview.columns.map((col) => <th key={col}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {preview.columns.map((col) => <td key={col}>{String(row[col] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="toolbar" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setPreview(null)} disabled={loading}>
              Cancelar
            </button>
            <button className="btn" onClick={handleImport} disabled={loading || !canImport}>
              {loading ? 'Importando...' : `Importar ${preview.rows.length} contato(s)`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="alert alert-success">
            {result.importedCount} contato(s) importado(s) com sucesso.
            {result.skippedCount > 0 && ` ${result.skippedCount} linha(s) ignorada(s) por telefone/email inválido ou vazio.`}
          </div>
          <div className="toolbar">
            <button className="btn btn-secondary" onClick={() => setResult(null)}>Importar outra planilha</button>
            <button className="btn" onClick={() => navigate('/contatos')}>Ver contatos importados</button>
          </div>
        </div>
      )}
    </div>
  );
}
