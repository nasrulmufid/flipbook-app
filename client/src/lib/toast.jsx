import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, message, tone }]);
    setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), tone === 'danger' ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`alert alert--${t.tone} pointer-events-auto`} style={{ boxShadow: 'var(--shadow-lg)', animation: 'fbPop .25s ease both' }}>
            {t.tone === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <div className="alert__description">{t.message}</div>
            <button type="button" className="button button--ghost button--icon-only button--sm" aria-label="Tutup" onClick={() => setItems((l) => l.filter((i) => i.id !== t.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
