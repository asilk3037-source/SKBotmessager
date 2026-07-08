import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RelatoriosPage from '../RelatoriosPage.jsx';
import { api } from '../../api.js';

vi.mock('../../api.js', () => ({
  api: {
    reportSummary: vi.fn(),
    listMessages: vi.fn(),
    exportCsvUrl: vi.fn((params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return `/api/reports/export.csv${qs ? `?${qs}` : ''}`;
    })
  }
}));

const SUMMARY = {
  totals: { campaigns: 1, messagesSent: 1, messagesFailed: 1, messagesTotal: 2 },
  campaigns: [{ id: 'camp-1', name: 'Campanha A' }]
};

const MESSAGES = [
  {
    id: 'm1',
    createdAt: '2025-01-01T10:00:00.000Z',
    contactName: 'Joao',
    recipient: '11988887777',
    channel: 'sms',
    status: 'sent',
    error: null,
    subject: '',
    content: 'Oi Joao'
  },
  {
    id: 'm2',
    createdAt: '2025-01-02T10:00:00.000Z',
    contactName: 'Maria',
    recipient: 'maria@example.com',
    channel: 'email',
    status: 'failed',
    error: 'Connection timeout',
    subject: 'Assunto',
    content: 'Oi Maria'
  }
];

beforeEach(() => {
  vi.clearAllMocks();
  api.reportSummary.mockResolvedValue(SUMMARY);
  api.listMessages.mockResolvedValue({ total: 2, messages: MESSAGES });
});

describe('RelatoriosPage', () => {
  it('shows the loading state before data arrives', () => {
    api.reportSummary.mockReturnValue(new Promise(() => {}));
    render(<RelatoriosPage />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('renders the summary stat cards', async () => {
    render(<RelatoriosPage />);
    await waitFor(() => expect(screen.getByText('Disparos realizados')).toBeInTheDocument());

    // campaigns, messagesSent and messagesFailed are all 1 in this fixture.
    expect(screen.getAllByText('1')).toHaveLength(3);
    expect(screen.getByText('2')).toBeInTheDocument(); // messagesTotal
  });

  it('lists messages with channel label, recipient, status badge and error', async () => {
    render(<RelatoriosPage />);
    await waitFor(() => expect(screen.getByText('Joao')).toBeInTheDocument());

    expect(screen.getByText('11988887777')).toBeInTheDocument();
    // "Enviada"/"Falhou" also name filter <option>s, so scope to the status badges in the table.
    expect(screen.getByText('Joao').closest('tr')).toHaveTextContent('Enviada');
    expect(screen.getByText('Maria').closest('tr')).toHaveTextContent('Falhou');
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    expect(screen.getByText('Assunto')).toBeInTheDocument();
  });

  it('shows the empty state when there are no messages', async () => {
    api.listMessages.mockResolvedValue({ total: 0, messages: [] });
    render(<RelatoriosPage />);
    await waitFor(() => expect(screen.getByText(/nenhum envio encontrado/i)).toBeInTheDocument());
  });

  it('reloads messages with the channel filter applied', async () => {
    render(<RelatoriosPage />);
    await waitFor(() => expect(screen.getByText('Joao')).toBeInTheDocument());

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], 'email'); // channel select

    await waitFor(() =>
      expect(api.listMessages).toHaveBeenLastCalledWith(expect.objectContaining({ channel: 'email' }))
    );
  });

  it('builds the CSV export link with the active filters', async () => {
    render(<RelatoriosPage />);
    await waitFor(() => expect(screen.getByText('Joao')).toBeInTheDocument());

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[2], 'sent'); // status select

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /exportar csv/i })).toHaveAttribute(
        'href',
        '/api/reports/export.csv?status=sent'
      )
    );
  });
});
