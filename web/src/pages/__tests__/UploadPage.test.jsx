import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import UploadPage from '../UploadPage.jsx';
import { api } from '../../api.js';

vi.mock('../../api.js', () => ({
  api: { previewSpreadsheet: vi.fn(), importContacts: vi.fn() }
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <UploadPage />
    </MemoryRouter>
  );
}

const PREVIEW = {
  fileName: 'contatos.csv',
  columns: ['Nome', 'Telefone', 'Email'],
  rows: [{ Nome: 'Joao', Telefone: '11988887777', Email: 'joao@example.com' }],
  suggestedNameColumn: 'Nome',
  suggestedPhoneColumn: 'Telefone',
  suggestedEmailColumn: 'Email'
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UploadPage', () => {
  it('shows an error and no preview when the spreadsheet has no rows', async () => {
    api.previewSpreadsheet.mockResolvedValue({ ...PREVIEW, rows: [] });
    renderPage();

    const file = new File(['a'], 'vazio.csv', { type: 'text/csv' });
    await userEvent.upload(document.querySelector('input[type=file]'), file);

    await waitFor(() => expect(screen.getByText(/planilha está vazia/i)).toBeInTheDocument());
    expect(screen.queryByText(/configurar importação/i)).not.toBeInTheDocument();
  });

  it('shows a preview with pre-selected columns after a successful upload', async () => {
    api.previewSpreadsheet.mockResolvedValue(PREVIEW);
    renderPage();

    const file = new File(['a'], 'contatos.csv', { type: 'text/csv' });
    await userEvent.upload(document.querySelector('input[type=file]'), file);

    await waitFor(() => expect(screen.getByText(/configurar importação/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/coluna com o nome/i)).toHaveValue('Nome');
    expect(screen.getByLabelText(/telefone \(whatsapp/i)).toHaveValue('Telefone');
    expect(screen.getByLabelText(/coluna com o email/i)).toHaveValue('Email');
    expect(screen.getByRole('button', { name: /importar 1 contato/i })).toBeEnabled();
  });

  it('disables the import button and shows a hint when neither phone nor email is selected', async () => {
    api.previewSpreadsheet.mockResolvedValue({
      ...PREVIEW,
      suggestedPhoneColumn: null,
      suggestedEmailColumn: null
    });
    renderPage();

    await userEvent.upload(document.querySelector('input[type=file]'), new File(['a'], 'c.csv'));

    await waitFor(() => expect(screen.getByText(/configurar importação/i)).toBeInTheDocument());
    expect(screen.getByText(/selecione o nome e ao menos uma coluna/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importar 1 contato/i })).toBeDisabled();
  });

  it('imports contacts and shows a success summary with the skipped count', async () => {
    api.previewSpreadsheet.mockResolvedValue(PREVIEW);
    api.importContacts.mockResolvedValue({ importedCount: 1, skippedCount: 2, skipped: [] });
    renderPage();

    await userEvent.upload(document.querySelector('input[type=file]'), new File(['a'], 'c.csv'));
    await waitFor(() => screen.getByRole('button', { name: /importar 1 contato/i }));
    await userEvent.click(screen.getByRole('button', { name: /importar 1 contato/i }));

    await waitFor(() => expect(screen.getByText(/1 contato\(s\) importado\(s\) com sucesso/i)).toBeInTheDocument());
    expect(screen.getByText(/2 linha\(s\) ignorada\(s\)/i)).toBeInTheDocument();

    expect(api.importContacts).toHaveBeenCalledWith(
      expect.objectContaining({ nameColumn: 'Nome', phoneColumn: 'Telefone', emailColumn: 'Email' })
    );
  });

  it('shows the error message when the preview request fails', async () => {
    api.previewSpreadsheet.mockRejectedValue(new Error('Não foi possível ler a planilha: corrupt'));
    renderPage();

    await userEvent.upload(document.querySelector('input[type=file]'), new File(['a'], 'c.csv'));

    await waitFor(() => expect(screen.getByText(/não foi possível ler a planilha/i)).toBeInTheDocument());
  });

  it('accepts a file dropped onto the dropzone', async () => {
    api.previewSpreadsheet.mockResolvedValue(PREVIEW);
    const { container } = renderPage();
    const dropzone = container.querySelector('.dropzone');
    const file = new File(['a'], 'contatos.csv', { type: 'text/csv' });

    fireEvent.dragOver(dropzone);
    expect(dropzone).toHaveClass('dragover');

    fireEvent.dragLeave(dropzone);
    expect(dropzone).not.toHaveClass('dragover');

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/configurar importação/i)).toBeInTheDocument());
    expect(api.previewSpreadsheet).toHaveBeenCalledWith(file);
  });
});
