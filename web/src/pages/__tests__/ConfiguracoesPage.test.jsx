import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfiguracoesPage from '../ConfiguracoesPage.jsx';
import { api } from '../../api.js';

vi.mock('../../api.js', () => ({
  api: {
    getWhatsappStatus: vi.fn(),
    connectWhatsapp: vi.fn(),
    logoutWhatsapp: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn()
  }
}));

const SMS_PROVIDERS = [
  { id: 'twilio', label: 'Twilio', requiredFields: ['accountSid', 'authToken', 'fromNumber'] },
  { id: 'mock', label: 'Simulado (teste, não envia de verdade)', requiredFields: [] },
  { id: 'androidGateway', label: 'Celular Android (SMS Gateway)', requiredFields: ['baseUrl', 'login', 'password'] }
];

function settingsResponse(overrides = {}) {
  return {
    settings: {
      sms: { provider: 'twilio', accountSid: '', authToken: '', fromNumber: '', baseUrl: '', login: '', password: '' },
      email: { user: '', appPassword: '', fromName: '' },
      delayBetweenMessagesMs: 3000,
      ...overrides
    },
    smsProviders: SMS_PROVIDERS
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getWhatsappStatus.mockResolvedValue({ status: 'disconnected', qrDataUrl: null, connectedNumber: null, error: null });
  api.getSettings.mockResolvedValue(settingsResponse());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ConfiguracoesPage - WhatsApp', () => {
  it('shows "Desconectado" and a connect button by default', async () => {
    render(<ConfiguracoesPage />);
    await waitFor(() => expect(screen.getByText('Desconectado')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /conectar whatsapp/i })).toBeInTheDocument();
  });

  it('calls api.connectWhatsapp and reflects the returned status', async () => {
    api.connectWhatsapp.mockResolvedValue({ status: 'connecting', qrDataUrl: null, connectedNumber: null, error: null });
    render(<ConfiguracoesPage />);
    await waitFor(() => screen.getByRole('button', { name: /conectar whatsapp/i }));

    await userEvent.click(screen.getByRole('button', { name: /conectar whatsapp/i }));

    await waitFor(() => expect(screen.getByText('Conectando...')).toBeInTheDocument());
    expect(api.connectWhatsapp).toHaveBeenCalled();
  });

  it('shows the QR code image once the backend reports status "qr"', async () => {
    api.getWhatsappStatus.mockResolvedValue({
      status: 'qr',
      qrDataUrl: 'data:image/png;base64,abc',
      connectedNumber: null,
      error: null
    });
    render(<ConfiguracoesPage />);

    await waitFor(() => expect(screen.getByAltText('QR Code WhatsApp')).toHaveAttribute('src', 'data:image/png;base64,abc'));
  });

  it('shows the connected number and a disconnect button when connected', async () => {
    api.getWhatsappStatus.mockResolvedValue({ status: 'connected', qrDataUrl: null, connectedNumber: '5511999999999', error: null });
    render(<ConfiguracoesPage />);

    await waitFor(() => expect(screen.getByText(/número conectado: 5511999999999/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /desconectar/i })).toBeInTheDocument();
  });

  it('logs out after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.getWhatsappStatus.mockResolvedValue({ status: 'connected', qrDataUrl: null, connectedNumber: '5511999999999', error: null });
    api.logoutWhatsapp.mockResolvedValue({ status: 'disconnected', qrDataUrl: null, connectedNumber: null, error: null });
    render(<ConfiguracoesPage />);

    await waitFor(() => screen.getByRole('button', { name: /desconectar/i }));
    await userEvent.click(screen.getByRole('button', { name: /desconectar/i }));

    expect(api.logoutWhatsapp).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: /conectar whatsapp/i })).toBeInTheDocument());
  });

  it('shows a connection error message returned by the backend', async () => {
    api.getWhatsappStatus.mockResolvedValue({
      status: 'disconnected',
      qrDataUrl: null,
      connectedNumber: null,
      error: 'net::ERR_TUNNEL_CONNECTION_FAILED'
    });
    render(<ConfiguracoesPage />);

    await waitFor(() => expect(screen.getByText(/falha ao conectar: net::err_tunnel/i)).toBeInTheDocument());
  });

  it('polls the status endpoint while connecting/qr, and stops once connected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.getWhatsappStatus
      .mockResolvedValueOnce({ status: 'qr', qrDataUrl: 'data:x', connectedNumber: null, error: null })
      .mockResolvedValueOnce({ status: 'connected', qrDataUrl: null, connectedNumber: '5511999999999', error: null });

    render(<ConfiguracoesPage />);
    await vi.waitFor(() => expect(screen.getByAltText('QR Code WhatsApp')).toBeInTheDocument());
    expect(api.getWhatsappStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2100);
    await vi.waitFor(() => expect(api.getWhatsappStatus).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(screen.getByText(/número conectado/i)).toBeInTheDocument());

    // Now connected: no more polling should occur even after the interval would have fired again.
    await vi.advanceTimersByTimeAsync(2100);
    expect(api.getWhatsappStatus).toHaveBeenCalledTimes(2);
  }, 10000);
});

describe('ConfiguracoesPage - SMS provider fields', () => {
  it('shows Twilio fields when provider is twilio', async () => {
    render(<ConfiguracoesPage />);
    await waitFor(() => expect(screen.getByLabelText('Account SID')).toBeInTheDocument());
    expect(screen.getByLabelText('Auth Token')).toBeInTheDocument();
  });

  it('shows the simulated-mode notice when provider is mock', async () => {
    api.getSettings.mockResolvedValue(settingsResponse({ sms: { provider: 'mock' } }));
    render(<ConfiguracoesPage />);
    await waitFor(() => expect(screen.getByText(/modo simulado/i)).toBeInTheDocument());
  });

  it('shows Android Gateway fields when provider is androidGateway', async () => {
    api.getSettings.mockResolvedValue(settingsResponse({ sms: { provider: 'androidGateway', baseUrl: '', login: '', password: '' } }));
    render(<ConfiguracoesPage />);

    await waitFor(() => expect(screen.getByLabelText(/url do serviço/i)).toBeInTheDocument());
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });

  it('switching the provider dropdown swaps the visible fields', async () => {
    render(<ConfiguracoesPage />);
    await waitFor(() => screen.getByLabelText('Account SID'));

    await userEvent.selectOptions(screen.getByLabelText(/provedor de sms/i), 'androidGateway');

    expect(screen.queryByLabelText('Account SID')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/url do serviço/i)).toBeInTheDocument();
  });

  it('saves the SMS section with the edited values', async () => {
    api.updateSettings.mockResolvedValue({});
    render(<ConfiguracoesPage />);
    await waitFor(() => screen.getByLabelText('Account SID'));

    await userEvent.type(screen.getByLabelText('Account SID'), 'ACxxx');
    await userEvent.click(screen.getByRole('button', { name: /salvar sms/i }));

    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith({
        sms: expect.objectContaining({ provider: 'twilio', accountSid: 'ACxxx' })
      })
    );
    await waitFor(() => expect(screen.getAllByText(/configurações salvas/i).length).toBeGreaterThan(0));
  });
});

describe('ConfiguracoesPage - Email and Ritmo de envio', () => {
  it('saves the email section', async () => {
    api.updateSettings.mockResolvedValue({});
    render(<ConfiguracoesPage />);
    await waitFor(() => screen.getByLabelText(/seu gmail/i));

    await userEvent.type(screen.getByLabelText(/seu gmail/i), 'me@gmail.com');
    await userEvent.click(screen.getByRole('button', { name: /salvar email/i }));

    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith({
        email: expect.objectContaining({ user: 'me@gmail.com' })
      })
    );
  });

  it('saves the delay as a number', async () => {
    api.updateSettings.mockResolvedValue({});
    render(<ConfiguracoesPage />);
    await waitFor(() => screen.getByLabelText(/intervalo entre mensagens/i));

    const delayInput = screen.getByLabelText(/intervalo entre mensagens/i);
    await userEvent.clear(delayInput);
    await userEvent.type(delayInput, '5000');
    await userEvent.click(screen.getByRole('button', { name: /salvar ritmo de envio/i }));

    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({ delayBetweenMessagesMs: 5000 }));
  });
});
