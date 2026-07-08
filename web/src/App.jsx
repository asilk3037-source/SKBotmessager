import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import UploadPage from './pages/UploadPage.jsx';
import ContatosPage from './pages/ContatosPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import DisparoPage from './pages/DisparoPage.jsx';
import RelatoriosPage from './pages/RelatoriosPage.jsx';
import ConfiguracoesPage from './pages/ConfiguracoesPage.jsx';

const NAV_ITEMS = [
  { to: '/upload', label: 'Importar planilha' },
  { to: '/contatos', label: 'Contatos' },
  { to: '/templates', label: 'Mensagens padrão' },
  { to: '/disparo', label: 'Disparo em massa' },
  { to: '/relatorios', label: 'Relatórios' },
  { to: '/configuracoes', label: 'Configurações' },
];

export default function App() {
  return (
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
  );
}
