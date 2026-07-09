import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import TitleBar from './components/TitleBar.jsx';
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
  { to: '/upload', label: 'Importar planilha', icon: 'M12 16V4m0 0-4 4m4-4 4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' },
  { to: '/contatos', label: 'Contatos', icon: 'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 9v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M6 10a3 3 0 1 0-3-3M3 20v-1a4 4 0 0 1 3-3.87' },
  { to: '/templates', label: 'Mensagens padrão', icon: 'M4 5h16v11H8l-4 4V5Z' },
  { to: '/disparo', label: 'Disparo em massa', icon: 'M4 12 20 4l-6 16-3-7-7-1Z' },
  { to: '/relatorios', label: 'Relatórios', icon: 'M4 20V10m6 10V4m6 16v-7' },
  { to: '/configuracoes', label: 'Configurações', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a7.97 7.97 0 0 0-.2-1.8l2.1-1.6-2-3.4-2.5 1a8 8 0 0 0-3.1-1.8L14 2h-4l-.3 2.4a8 8 0 0 0-3.1 1.8l-2.5-1-2 3.4 2.1 1.6A8 8 0 0 0 4 12c0 .6.07 1.2.2 1.8l-2.1 1.6 2 3.4 2.5-1a8 8 0 0 0 3.1 1.8L10 22h4l.3-2.4a8 8 0 0 0 3.1-1.8l2.5 1 2-3.4-2.1-1.6c.13-.6.2-1.2.2-1.8Z' },
];

export default function App() {
  return (
    <>
      <TitleBar />
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">SKBotmessager</div>
          <div className="sidebar-subtitle">Disparo em massa de SMS e WhatsApp</div>
          <nav>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <Icon path={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/contatos" element={<ContatosPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/disparo" element={<DisparoPage />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          </Routes>
        </main>
      </div>
    </>
  );
}
