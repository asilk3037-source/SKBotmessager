import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ContatosPage from '../ContatosPage.jsx';
import { api } from '../../api.js';

vi.mock('../../api.js', () => ({
  api: {
    listBatches: vi.fn(),
    listContacts: vi.fn(),
    deleteContact: vi.fn(),
    deleteBatch: vi.fn()
  }
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ContatosPage />
    </MemoryRouter>
  );
}

const BATCH = { id: 'b1', label: 'Lote 1', importedCount: 2, skippedCount: 0, createdAt: '2025-01-01T00:00:00.000Z' };
const CONTACT = { id: 'c1', name: 'Joao', phone: '11988887777', email: 'joao@example.com', extras: { Cidade: 'SP' } };

beforeEach(() => {
  vi.clearAllMocks();
  api.listBatches.mockResolvedValue([BATCH]);
  api.listContacts.mockResolvedValue({ total: 1, contacts: [CONTACT] });
});

describe('ContatosPage', () => {
  it('shows the empty state with a link to /upload when there are no batches', async () => {
    api.listBatches.mockResolvedValue([]);
    api.listContacts.mockResolvedValue({ total: 0, contacts: [] });
    renderPage();

    await waitFor(() => expect(screen.getByText(/nenhum contato importado ainda/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /importe uma planilha/i })).toHaveAttribute('href', '/upload');
  });

  it('lists batches and contacts once loaded', async () => {
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Lote 1').length).toBeGreaterThan(0));
    // Contact list loads on a 250ms debounce, so wait for it explicitly too.
    await waitFor(() => expect(screen.getByText('Joao')).toBeInTheDocument());
    expect(screen.getByText('11988887777')).toBeInTheDocument();
    expect(screen.getByText('joao@example.com')).toBeInTheDocument();
    expect(screen.getByText('Cidade: SP')).toBeInTheDocument();
  });

  it('shows a dash for missing phone/email instead of blank cells', async () => {
    api.listContacts.mockResolvedValue({
      total: 1,
      contacts: [{ id: 'c2', name: 'Ana', phone: '', email: '', extras: {} }]
    });
    renderPage();

    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(2);
  });

  it('deletes a contact after confirmation and reloads the list', async () => {
    api.deleteContact.mockResolvedValue(null);
    renderPage();

    await waitFor(() => expect(screen.getByText('Joao')).toBeInTheDocument());
    // "Remover" appears once per batch row and once per contact row; the contact row
    // renders after the batches table, so it's the last "Remover" button in the DOM.
    const removeButtons = screen.getAllByRole('button', { name: 'Remover' });
    await userEvent.click(removeButtons[removeButtons.length - 1]);

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remover' }));

    expect(api.deleteContact).toHaveBeenCalledWith('c1');
    await waitFor(() => expect(api.listContacts).toHaveBeenCalledTimes(2));
  });

  it('does not delete the contact when the confirmation is cancelled', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Joao')).toBeInTheDocument());
    const removeButtons = screen.getAllByRole('button', { name: 'Remover' });
    await userEvent.click(removeButtons[removeButtons.length - 1]);

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(api.deleteContact).not.toHaveBeenCalled();
  });

  it('deletes a whole batch after confirmation', async () => {
    api.deleteBatch.mockResolvedValue({ removedContacts: 2 });
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Lote 1').length).toBeGreaterThan(0));
    // The batch row's "Remover" button is the first one in the DOM.
    const removeButtons = screen.getAllByRole('button', { name: 'Remover' });
    await userEvent.click(removeButtons[0]);

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remover' }));

    expect(api.deleteBatch).toHaveBeenCalledWith('b1');
  });

  it('shows pagination controls when there are more contacts than fit on one page, and advances the page', async () => {
    api.listContacts.mockResolvedValue({ total: 120, contacts: [CONTACT] });
    renderPage();

    await waitFor(() => expect(screen.getByText(/página 1 de 3/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() =>
      expect(api.listContacts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 50 }))
    );
  });

  it('debounces the search box before calling listContacts again', async () => {
    renderPage();
    await waitFor(() => expect(api.listContacts).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByPlaceholderText(/buscar por nome/i), 'joao');

    // Still just the initial call right after typing (debounce not elapsed yet).
    expect(api.listContacts).toHaveBeenCalledTimes(1);

    await waitFor(
      () => expect(api.listContacts).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'joao' })),
      { timeout: 1000 }
    );
  });

  it('shows an error message when loading contacts fails', async () => {
    api.listContacts.mockRejectedValue(new Error('Falha de rede'));
    renderPage();

    await waitFor(() => expect(screen.getByText('Falha de rede')).toBeInTheDocument());
  });
});
