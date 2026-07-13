import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SpreadsheetImportForm from '../components/SpreadsheetImportForm.jsx';

export default function UploadPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);

  return (
    <div>
      <h1 className="page-title">Importar planilha</h1>
      <p className="page-subtitle">
        Suba a planilha (.xlsx ou .csv) com os contatos que você normalmente usa para enviar mensagem manualmente.
      </p>

      {!result && (
        <div className="card">
          <SpreadsheetImportForm onImported={setResult} />
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
