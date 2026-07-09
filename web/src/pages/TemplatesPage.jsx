import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { CHANNEL_LABELS } from '../constants.js';

const EMPTY_FORM = { id: null, name: '', content: '', subject: '', channel: 'any', isDefault: false };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api.listTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  function insertVariable(varName) {
    setForm((f) => ({ ...f, content: `${f.content}{{${varName}}}` }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        content: form.content,
        subject: form.subject,
        channel: form.channel,
        isDefault: form.isDefault,
      };
      if (form.id) {
        await api.updateTemplate(form.id, payload);
      } else {
        await api.createTemplate(payload);
      }
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remover este template?')) return;
    try {
      await api.deleteTemplate(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const usesEmail = form.channel === 'email' || form.channel === 'any';

  return (
    <div>
      <h1 className="page-title">Mensagens padrão</h1>
      <p className="page-subtitle">
        Crie modelos de mensagem reutilizáveis. Use variáveis como <code>{'{{nome}}'}</code> para
        personalizar cada envio com os dados da planilha.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>{form.id ? 'Editar template' : 'Novo template'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label htmlFor="template-name">Nome do template</label>
              <input
                id="template-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="template-channel">Canal</label>
              <select
                id="template-channel"
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
              >
                <option value="any">Qualquer canal (WhatsApp, SMS ou Email)</option>
                <option value="whatsapp">Somente WhatsApp</option>
                <option value="sms">Somente SMS</option>
                <option value="email">Somente Email</option>
              </select>
            </div>
          </div>

          {usesEmail && (
            <div className="field">
              <label htmlFor="template-subject">Assunto do email</label>
              <input
                id="template-subject"
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Ex: Olá {{nome}}, uma novidade pra você"
              />
              <p className="helper-text">Usado apenas quando a mensagem for enviada por email.</p>
            </div>
          )}

          <div className="field">
            <label htmlFor="template-content">Mensagem</label>
            <textarea
              id="template-content"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Olá {{nome}}, tudo bem?"
              required
            />
            <div className="helper-text">
              Clique para inserir variável:{' '}
              <button type="button" className="tag" onClick={() => insertVariable('nome')}>{'{{nome}}'}</button>{' '}
              <button type="button" className="tag" onClick={() => insertVariable('telefone')}>{'{{telefone}}'}</button>{' '}
              Você também pode usar qualquer nome de coluna extra da sua planilha, ex: <code>{'{{cidade}}'}</code>.
            </div>
          </div>

          <div className="field checkbox-row">
            <input
              type="checkbox"
              id="isDefault"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            <label htmlFor="isDefault" style={{ margin: 0 }}>Definir como padrão para este canal</label>
          </div>

          <div className="toolbar">
            {form.id && (
              <button type="button" className="btn btn-secondary" onClick={() => setForm(EMPTY_FORM)}>
                Cancelar edição
              </button>
            )}
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Criar template'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Templates salvos</h3>
        {templates.length === 0 ? (
          <div className="empty-state">Nenhum template criado ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Canal</th>
                <th>Mensagem</th>
                <th>Padrão</th>
                <th aria-label="Ações"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{CHANNEL_LABELS[t.channel] ?? t.channel}</td>
                  <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{t.content}</td>
                  <td>{t.isDefault && <span className="badge badge-success">Padrão</span>}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setForm({ ...EMPTY_FORM, ...t })}>Editar</button>{' '}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
