import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';

// Route to lightweight stubs so this test only exercises layout/navigation,
// not each page's own data loading.
vi.mock('../pages/DashboardPage.jsx', () => ({ default: () => <div>Tela: Dashboard</div> }));
vi.mock('../pages/UploadPage.jsx', () => ({ default: () => <div>Tela: Upload</div> }));
vi.mock('../pages/ContatosPage.jsx', () => ({ default: () => <div>Tela: Contatos</div> }));
vi.mock('../pages/TemplatesPage.jsx', () => ({ default: () => <div>Tela: Templates</div> }));
vi.mock('../pages/DisparoPage.jsx', () => ({ default: () => <div>Tela: Disparo</div> }));
vi.mock('../pages/RelatoriosPage.jsx', () => ({ default: () => <div>Tela: Relatorios</div> }));
vi.mock('../pages/ConfiguracoesPage.jsx', () => ({ default: () => <div>Tela: Configuracoes</div> }));
vi.mock('../pages/AuditoriaPage.jsx', () => ({ default: () => <div>Tela: Auditoria</div> }));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe('App', () => {
  it('renders the sidebar brand', () => {
    renderAt('/upload');
    expect(screen.getByText('SKBotmessager')).toBeInTheDocument();
  });

  it('redirects the root path to /dashboard', () => {
    renderAt('/');
    expect(screen.getByText('Tela: Dashboard')).toBeInTheDocument();
  });

  it('renders the matching page for each nav route', () => {
    renderAt('/relatorios');
    expect(screen.getByText('Tela: Relatorios')).toBeInTheDocument();
  });

  it('marks the current nav link as active', () => {
    renderAt('/templates');
    expect(screen.getByRole('link', { name: 'Mensagens padrão' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'Contatos' })).not.toHaveClass('active');
  });

  it('navigates to a different page when a nav link is clicked', async () => {
    renderAt('/upload');
    await userEvent.click(screen.getByRole('link', { name: 'Configurações' }));
    expect(screen.getByText('Tela: Configuracoes')).toBeInTheDocument();
  });

  it('renders the Auditoria page', () => {
    renderAt('/auditoria');
    expect(screen.getByText('Tela: Auditoria')).toBeInTheDocument();
  });
});
