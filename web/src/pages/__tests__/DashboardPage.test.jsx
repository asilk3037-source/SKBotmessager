import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../DashboardPage.jsx';
import { api } from '../../api.js';

vi.mock('../../api.js', () => ({
  api: {
    reportDashboard: vi.fn()
  }
}));

const TREND = Array.from({ length: 14 }, (_, i) => ({
  date: `2025-01-${String(i + 1).padStart(2, '0')}`,
  sent: i,
  failed: i % 3
}));

const DASHBOARD_DATA = {
  totals: { campaigns: 3, messagesSent: 40, messagesFailed: 10, messagesPending: 0, messagesTotal: 50 },
  deliveryRate: 80,
  byChannel: [
    { channel: 'whatsapp', sent: 20, failed: 5, pending: 0, total: 25 },
    { channel: 'sms', sent: 20, failed: 5, pending: 0, total: 25 }
  ],
  trend: TREND,
  recentCampaigns: [
    { id: 'camp-1', name: 'Campanha A', status: 'completed', createdAt: '2025-01-05T00:00:00.000Z', sent: 20, failed: 5, total: 25 },
    { id: 'camp-2', name: 'Campanha B', status: 'running', createdAt: '2025-01-06T00:00:00.000Z', sent: 20, failed: 5, total: 25 }
  ]
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.reportDashboard.mockResolvedValue(DASHBOARD_DATA);
});

describe('DashboardPage', () => {
  it('shows a loading state before data arrives', () => {
    api.reportDashboard.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('renders the KPI cards once data loads', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Mensagens enviadas')).toBeInTheDocument());

    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows a dash for delivery rate when there is no sent/failed data yet', async () => {
    api.reportDashboard.mockResolvedValue({
      ...DASHBOARD_DATA,
      totals: { ...DASHBOARD_DATA.totals, messagesSent: 0, messagesFailed: 0, messagesTotal: 3 },
      deliveryRate: null
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument());
  });

  it('renders the per-channel breakdown with translated channel labels', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('WhatsApp')).toBeInTheDocument());
    expect(screen.getByText('SMS')).toBeInTheDocument();
  });

  it('lists recent campaigns with their status badge', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Campanha A')).toBeInTheDocument());

    expect(screen.getByText('Campanha A').closest('tr')).toHaveTextContent('Concluída');
    expect(screen.getByText('Campanha B').closest('tr')).toHaveTextContent('Em andamento');
  });

  it('shows an empty state with a link to /upload when there is no data at all', async () => {
    api.reportDashboard.mockResolvedValue({
      totals: { campaigns: 0, messagesSent: 0, messagesFailed: 0, messagesPending: 0, messagesTotal: 0 },
      deliveryRate: null,
      byChannel: [],
      trend: TREND.map((d) => ({ ...d, sent: 0, failed: 0 })),
      recentCampaigns: []
    });
    renderPage();

    await waitFor(() => expect(screen.getByText(/nenhum envio registrado/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /importe uma planilha/i })).toHaveAttribute('href', '/upload');
  });

  it('shows an error message when loading the dashboard fails', async () => {
    api.reportDashboard.mockRejectedValue(new Error('Falha ao carregar'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Falha ao carregar')).toBeInTheDocument());
  });
});
