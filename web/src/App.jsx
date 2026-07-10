import { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import TitleBar from './components/TitleBar.jsx';
import { useTheme } from './hooks/useTheme.js';
import DashboardPage from './pages/DashboardPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import ContatosPage from './pages/ContatosPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import DisparoPage from './pages/DisparoPage.jsx';
import RelatoriosPage from './pages/RelatoriosPage.jsx';
import ConfiguracoesPage from './pages/ConfiguracoesPage.jsx';

function Icon({ path }) {
  return (
    <svg className="nav-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'M4 20V10m6 10V4m6 16v-7' },
  { to: '/upload', label: 'Importar planilha', icon: 'M12 16V4m0 0-4 4m4-4 4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' },
  { to: '/contatos', label: 'Contatos', icon: 'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 9v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M6 10a3 3 0 1 0-3-3M3 20v-1a4 4 0 0 1 3-3.87' },
  { to: '/templates', label: 'Mensagens padrão', icon: 'M4 5h16v11H8l-4 4V5Z' },
  { to: '/disparo', label: 'Disparo em massa', icon: 'M4 12 20 4l-6 16-3-7-7-1Z' },
  { to: '/relatorios', label: 'Relatórios', icon: 'M4 20V10m6 10V4m6 16v-7' },
  { to: '/configuracoes', label: 'Configurações', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a7.97 7.97 0 0 0-.2-1.8l2.1-1.6-2-3.4-2.5 1a8 8 0 0 0-3.1-1.8L14 2h-4l-.3 2.4a8 8 0 0 0-3.1 1.8l-2.5-1-2 3.4 2.1 1.6A8 8 0 0 0 4 12c0 .6.07 1.2.2 1.8l-2.1 1.6 2 3.4 2.5-1a8 8 0 0 0 3.1 1.8L10 22h4l.3-2.4a8 8 0 0 0 3.1-1.8l2.5 1 2-3.4-2.1-1.6c.13-.6.2-1.2.2-1.8Z' },
];

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <>
      <TitleBar />
      <div className="app-shell">
        <button
          type="button"
          className="menu-toggle"
          aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setSidebarOpen((open) => !open)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        {sidebarOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Fechar menu"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-brand">SKBotmessager</div>
          <div className="sidebar-subtitle">Disparo em massa de SMS e WhatsApp</div>
          <nav>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon path={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            className="theme-toggle"
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            data-tooltip={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-6.66 1.42-1.42M4.92 19.08l1.42-1.42m0-13.32L4.92 4.92m14.16 14.16-1.42-1.42M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
        </aside>
        <main className="main">
          <div key={location.pathname} className="page-transition">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/contatos" element={<ContatosPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/disparo" element={<DisparoPage />} />
              <Route path="/relatorios" element={<RelatoriosPage />} />
              <Route path="/configuracoes" element={<ConfiguracoesPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </>
  );
}
