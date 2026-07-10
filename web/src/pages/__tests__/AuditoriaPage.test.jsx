import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditoriaPage from '../AuditoriaPage.jsx';
import { api } from '../../api.js';

vi.mock('../../api.js', () => ({
  api: {
    listAuditLog: vi.fn()
  }
}));

const ENTRIES = [
  {
    id: 'a1',
    action: 'campaigns.start',
    entity: 'campaign',
    entityId: 'c1',
    meta: { name: 'Promoção Julho', channel: 'sms', totalCount: 50 },
    createdAt: '2025-01-02T10:00:00.000Z'
  },
  {
    id: 'a2',
    action: 'templates.create',
    entity: 'template',
    entityId: 't1',
    meta: { name: 'Boas-vindas' },
    createdAt: '2025-01-01T10:00:00.000Z'
  }
];

beforeEach(() => {
  vi.clearAllMocks();
  api.listAuditLog.mockResolvedValue({ total: 2, page: 1, pageSize: 50, entries: ENTRIES });
});

describe('AuditoriaPage', () => {
  it('shows the loading state before data arrives', () => {
    api.listAuditLog.mockReturnValue(new Promise(() => {}));
    render(<AuditoriaPage />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('lists entries with translated action labels and details', async () => {
    render(<AuditoriaPage />);
    await waitFor(() => expect(screen.getByText('Promoção Julho — 50 contato(s) via SMS')).toBeInTheDocument());

    // "Template criado" also names an <option> in the filter select, so scope to the table row.
    expect(screen.getByText('Template: Boas-vindas').closest('tr')).toHaveTextContent('Template criado');
    expect(screen.getByText('Promoção Julho — 50 contato(s) via SMS').closest('tr')).toHaveTextContent('Disparo iniciado');
  });

  it('shows the empty state when there is no audit history', async () => {
    api.listAuditLog.mockResolvedValue({ total: 0, page: 1, pageSize: 50, entries: [] });
    render(<AuditoriaPage />);
    await waitFor(() => expect(screen.getByText(/nenhuma ação registrada/i)).toBeInTheDocument());
  });

  it('reloads with the action filter applied and resets to page 1', async () => {
    render(<AuditoriaPage />);
    await waitFor(() => expect(screen.getByText('Disparo iniciado')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText(/filtrar por ação/i), 'templates.create');

    await waitFor(() =>
      expect(api.listAuditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'templates.create', page: 1, pageSize: 50 })
      )
    );
  });

  it('shows pagination controls when there are more entries than fit on one page', async () => {
    api.listAuditLog.mockResolvedValue({ total: 120, page: 1, pageSize: 50, entries: ENTRIES });
    render(<AuditoriaPage />);

    await waitFor(() => expect(screen.getByText(/página 1 de 3/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() =>
      expect(api.listAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 50 }))
    );
  });

  it('shows an error message when loading fails', async () => {
    api.listAuditLog.mockRejectedValue(new Error('Falha ao carregar auditoria'));
    render(<AuditoriaPage />);
    await waitFor(() => expect(screen.getByText('Falha ao carregar auditoria')).toBeInTheDocument());
  });
});
