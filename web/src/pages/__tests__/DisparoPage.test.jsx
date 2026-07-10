import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DisparoPage from '../DisparoPage.jsx';
import { api } from '../../api.js';

vi.mock('../../api.js', () => ({
  api: {
    listBatches: vi.fn(),
    listTemplates: vi.fn(),
    listContacts: vi.fn(),
    createCampaign: vi.fn(),
    getCampaign: vi.fn()
  }
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DisparoPage />
    </MemoryRouter>
  );
}

async function selectBatch() {
  // The batch <select> only gets its "b1" option once api.listBatches() resolves.
  await waitFor(() => expect(screen.getByText(/lote 1 \(2 contatos\)/i)).toBeInTheDocument());
  await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'b1');
  await waitFor(() => screen.getByText('Joao'));
}

const BATCH = { id: 'b1', label: 'Lote 1', importedCount: 2 };
const WA_TEMPLATE = { id: 'tw', name: 'Template WhatsApp', channel: 'whatsapp', content: 'Oi {{nome}}', isDefault: false };
const EMAIL_TEMPLATE = { id: 'te', name: 'Template Email', channel: 'email', subject: 'Assunto {{nome}}', content: 'Oi {{nome}}', isDefault: false };
const CONTACT_1 = { id: 'c1', name: 'Joao', phone: '11988887777', email: 'joao@example.com', extras: {} };
const CONTACT_NO_EMAIL = { id: 'c2', name: 'Maria', phone: '21977776666', email: '', extras: {} };

beforeEach(() => {
  vi.clearAllMocks();
  api.listBatches.mockResolvedValue([BATCH]);
  api.listTemplates.mockResolvedValue([WA_TEMPLATE, EMAIL_TEMPLATE]);
  api.listContacts.mockResolvedValue({ total: 2, contacts: [CONTACT_1, CONTACT_NO_EMAIL] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DisparoPage - setup', () => {
  it('shows a link to /upload when there are no batches', async () => {
    api.listBatches.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/nenhum lote importado/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /importe uma planilha primeiro/i })).toHaveAttribute('href', '/upload');
  });

  it('loads contacts for the selected batch and pre-selects all of them', async () => {
    renderPage();
    await selectBatch();
    expect(screen.getByText(/selecione os contatos \(2 de 2\)/i)).toBeInTheDocument();
  });

  it('marks a contact missing the channel-specific field with a warning badge', async () => {
    renderPage();
    await selectBatch();

    await userEvent.selectOptions(screen.getByLabelText(/canal de envio/i), 'email');

    const row = screen.getByText('Maria').closest('tr');
    expect(within(row).getByText(/sem email/i)).toBeInTheDocument();
  });

  it('filters the template dropdown by the selected channel', async () => {
    renderPage();
    await selectBatch();

    // Default channel is whatsapp: only the WhatsApp template should be selectable.
    const templateSelect = screen.getByLabelText(/template de mensagem/i);
    expect(within(templateSelect).getAllByRole('option')).toHaveLength(1);
    expect(templateSelect).toHaveValue('tw');

    await userEvent.selectOptions(screen.getByLabelText(/canal de envio/i), 'email');
    await waitFor(() => expect(templateSelect).toHaveValue('te'));
  });

  it('shows a rendered preview of the message for the selected contacts', async () => {
    renderPage();
    await selectBatch();

    await waitFor(() => expect(screen.getByRole('heading', { name: /pré-visualização/i })).toBeInTheDocument());
    expect(screen.getByText('Oi Joao')).toBeInTheDocument();
    expect(screen.getByText('Oi Maria')).toBeInTheDocument();
  });

  it('warns when some selected contacts lack the recipient field for email', async () => {
    renderPage();
    await selectBatch();
    await userEvent.selectOptions(screen.getByLabelText(/canal de envio/i), 'email');

    await waitFor(() =>
      expect(screen.getByText(/1 contato\(s\) selecionado\(s\) sem email cadastrado/i)).toBeInTheDocument()
    );
  });

  it('toggling a contact off removes it from the selection count', async () => {
    renderPage();
    await selectBatch();

    const joaoRow = screen.getByText('Joao').closest('tr');
    await userEvent.click(within(joaoRow).getByRole('checkbox'));

    expect(screen.getByText(/selecione os contatos \(1 de 2\)/i)).toBeInTheDocument();
  });

  it('"Desmarcar todos" clears the selection and hides the preview/dispatch card', async () => {
    renderPage();
    await selectBatch();

    await userEvent.click(screen.getByRole('button', { name: /desmarcar todos/i }));

    expect(screen.getByText(/selecione os contatos \(0 de 2\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /pré-visualização/i })).not.toBeInTheDocument();
  });
});

describe('DisparoPage - dispatch and progress', () => {
  async function setupReadyToDispatch() {
    renderPage();
    await selectBatch();
    await waitFor(() => screen.getByRole('heading', { name: /pré-visualização/i }));
  }

  it('starts a campaign and shows the "em andamento" progress screen', async () => {
    api.createCampaign.mockResolvedValue({
      id: 'camp-1',
      name: 'Disparo teste',
      status: 'running',
      totalCount: 2,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0
    });

    await setupReadyToDispatch();
    await userEvent.click(screen.getByRole('button', { name: /disparar para 2 contato/i }));

    await waitFor(() => expect(screen.getByText(/disparo em andamento/i)).toBeInTheDocument());
    expect(api.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'tw', channel: 'whatsapp', contactIds: ['c1', 'c2'] })
    );
    expect(screen.getByText(/0 de 2 processados/i)).toBeInTheDocument();
  });

  it('polls campaign status until it stops running, then shows the finishing actions', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.createCampaign.mockResolvedValue({
      id: 'camp-1',
      name: 'Disparo teste',
      status: 'running',
      totalCount: 2,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0
    });
    api.getCampaign.mockResolvedValue({
      id: 'camp-1',
      name: 'Disparo teste',
      status: 'completed',
      totalCount: 2,
      processedCount: 2,
      sentCount: 2,
      failedCount: 0
    });

    const user = userEvent.setup();
    await setupReadyToDispatch();
    await user.click(screen.getByRole('button', { name: /disparar para 2 contato/i }));
    await vi.waitFor(() => expect(screen.getByText(/disparo em andamento/i)).toBeInTheDocument());

    await vi.advanceTimersByTimeAsync(1600);

    expect(api.getCampaign).toHaveBeenCalledWith('camp-1');
    await vi.waitFor(() => expect(screen.getByText(/2 de 2 processados/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /novo disparo/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver relatório completo/i })).toHaveAttribute('href', '/relatorios');
  }, 10000);

  it('shows an error and stays on the setup screen when starting the campaign fails', async () => {
    api.createCampaign.mockRejectedValue(new Error('Canal deve ser "whatsapp", "sms" ou "email".'));
    await setupReadyToDispatch();

    await userEvent.click(screen.getByRole('button', { name: /disparar para 2 contato/i }));

    await waitFor(() =>
      expect(screen.getByText('Canal deve ser "whatsapp", "sms" ou "email".')).toBeInTheDocument()
    );
    expect(screen.queryByText(/disparo em andamento/i)).not.toBeInTheDocument();
  });

  it('"Novo disparo" returns to the setup screen', async () => {
    api.createCampaign.mockResolvedValue({
      id: 'camp-1',
      name: 'Disparo teste',
      status: 'completed',
      totalCount: 2,
      processedCount: 2,
      sentCount: 2,
      failedCount: 0
    });

    await setupReadyToDispatch();
    await userEvent.click(screen.getByRole('button', { name: /disparar para 2 contato/i }));
    await waitFor(() => screen.getByRole('button', { name: /novo disparo/i }));

    await userEvent.click(screen.getByRole('button', { name: /novo disparo/i }));

    expect(screen.getByText(/1\. escolha o lote de contatos/i)).toBeInTheDocument();
  });
});
