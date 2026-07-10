import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message, { type = 'success', duration = 3500 } = {}) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => dismiss(id), duration);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <output className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.message}</span>
            <button type="button" className="toast-close" aria-label="Fechar" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </output>
    </ToastContext.Provider>
  );
}

const noop = () => {};

// Falls back to a no-op instead of throwing when there's no provider above
// it, so pages can be unit-tested in isolation (as they already are)
// without every test needing to wrap in a ToastProvider just to satisfy
// this hook.
// eslint-disable-next-line react-refresh/only-export-components -- co-locating the hook with its provider is intentional here
export function useToast() {
  const showToast = useContext(ToastContext);
  return showToast ?? noop;
}
