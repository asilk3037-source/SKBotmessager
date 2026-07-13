import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { CHANNEL_LABELS } from '../constants.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { renderPreview } from '../utils/renderPreview.js';

const EMPTY_FORM = { id: null, name: '', content: '', subject: '', channel: 'any', isDefault: false };

const STARTER_TEMPLATES = [
  {
    label: 'Boas-vindas',
    channel: 'any',
    subject: 'Bem-vindo(a)!',
    content: 'Olá {{nome}}, seja bem-vindo(a)! Estamos felizes em ter você com a gente.'
  },
  {
    label: 'Confirmação de pedido',
    channel: 'whatsapp',
    subject: '',
    content: 'Olá {{nome}}, seu pedido foi confirmado e já está sendo preparado!'
  },
  {
    label: 'Lembrete de pagamento',
    channel: 'sms',
    subject: '',
    content: 'Olá {{nome}}, lembramos que seu pagamento vence em breve. Qualquer dúvida, estamos à disposição.'
  },
  {
    label: 'Promoção/Oferta',
    channel: 'any',
    subject: 'Oferta especial para você',
    content: 'Olá {{nome}}, temos uma oferta especial para você! Aproveite antes que acabe.'
  },
  {
    label: 'Agradecimento',
    channel: 'any',
    subject: 'Muito obrigado!',
    content: 'Olá {{nome}}, obrigado pela confiança! Estamos à disposição para o que precisar.'
  }
];

const FALLBACK_SAMPLE_CONTACT = {
  id: '__fallback',
  name: 'Maria Exemplo',
  phone: '11999998888',
  extras: { cidade: 'São Paulo' }
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmState, setConfirmState] = useState(null);
  const [sampleContacts, setSampleContacts] = useState([]);
  const [sampleContactId, setSampleContactId] = useState(FALLBACK_SAMPLE_CONTACT.id);
  const showToast = useToast();

  async function load() {
    try {
      const data = await api.listTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    api.listContacts({ pageSize: 5 })
      .then((data) => {
        if (data.contacts.length === 0) return;
        setSampleContacts(data.contacts);
        setSampleContactId(data.contacts[0].id);
      })
      .catch(() => {}); // preview just falls back to the placeholder contact
  }, []);

  const sampleContact = useMemo(
    () => sampleContacts.find((c) => c.id === sampleContactId) ?? FALLBACK_SAMPLE_CONTACT,
    [sampleContacts, sampleContactId]
  );

  function insertVariable(varName) {
    setForm((f) => ({ ...f, content: `${f.content}{{${varName}}}` }));
  }

  function applyStarter(starter) {
    setForm({ id: null, name: form.name, content: starter.content, subject: starter.subject, channel: starter.channel, isDefault: false });
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
      const wasEditing = Boolean(form.id);
      if (form.id) {
        await api.updateTemplate(form.id, payload);
      } else {
        await api.createTemplate(payload);
      }
      setForm(EMPTY_FORM);
      await load();
      showToast(wasEditing ? 'Template atualizado.' : 'Template criado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id) {
    setConfirmState({
      message: 'Remover este template?',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.deleteTemplate(id);
          load();
          showToast('Template removido.');
        } catch (err) {
          setError(err.message);
        }
      },
    });
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
        <h3>Modelos prontos</h3>
        <p className="helper-text">Comece a partir de um modelo comum e personalize à vontade.</p>
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          {STARTER_TEMPLATES.map((starter) => (
            <button
              key={starter.label}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => applyStarter(starter)}
            >
              {starter.label}
            </button>
          ))}
        </div>
      </div>

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
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>Pré-visualização</h3>
          {sampleContacts.length > 0 && (
            <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
              <label htmlFor="preview-contact" className="sr-only">Contato de exemplo</label>
              <select
                id="preview-contact"
                value={sampleContactId}
                onChange={(e) => setSampleContactId(e.target.value)}
              >
                {sampleContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
        {sampleContacts.length === 0 && (
          <p className="helper-text">
            Nenhum contato importado ainda — mostrando com um contato de exemplo fictício.
          </p>
        )}
        <div className="alert alert-info" style={{ whiteSpace: 'pre-wrap' }}>
          {usesEmail && form.subject && (
            <><strong>Assunto: {renderPreview(form.subject, sampleContact)}</strong><br /></>
          )}
          {form.content ? renderPreview(form.content, sampleContact) : (
            <span className="helper-text">A mensagem aparecerá aqui conforme você digita.</span>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Templates salvos</h3>
        {templates.length === 0 ? (
          <EmptyState icon="M4 5h16v11H8l-4 4V5Z">
            Nenhum template criado ainda.
          </EmptyState>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Canal</th>
                <th>Mensagem</th>
                <th>Padrão</th>
                <th aria-label="Ações" data-tooltip="Ações"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{CHANNEL_LABELS[t.channel] ?? t.channel}</td>
                  <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{t.content}</td>
                  <td>{t.isDefault && <span className="badge badge-success">Padrão</span>}</td>
                  <td aria-label="Ações">
                    <div className="table-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => setForm({ ...EMPTY_FORM, ...t })}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>Remover</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
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
