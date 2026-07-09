import { useEffect, useState } from 'react';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;

  useEffect(() => {
    if (!electronAPI) return undefined;
    electronAPI.isMaximized().then(setIsMaximized);
    return electronAPI.onMaximizedChange(setIsMaximized);
  }, [electronAPI]);

  if (!electronAPI) return null;

  return (
    <div className="titlebar">
      <div className="titlebar-title">
        <img src="/favicon.svg" alt="" width="15" height="15" />
        SKBotmessager
      </div>
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Minimizar"
          onClick={() => electronAPI.minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar-btn"
          aria-label={isMaximized ? 'Restaurar' : 'Maximizar'}
          onClick={() => electronAPI.toggleMaximize()}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" fill="var(--titlebar-bg, #12261d)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="titlebar-btn titlebar-btn-close"
          aria-label="Fechar"
          onClick={() => electronAPI.close()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
