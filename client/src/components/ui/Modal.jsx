import { useEffect } from 'react';
import { X } from 'lucide-react';

/** Dialog Stisla yang dikontrol lewat React (data-state). */
export default function Modal({ open, title, onClose, children, footer, size }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="dialog" data-state="open" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog__backdrop" onClick={onClose} />
      <div className={`dialog__panel ${size ? `dialog--${size}` : ''}`} style={size === 'xl' ? { maxWidth: '64rem' } : undefined}>
        <div className="dialog__content">
          <div className="dialog__header">
            <h3 className="dialog__title">{title}</h3>
            <button type="button" className="dialog__close" aria-label="Tutup" onClick={onClose}><X size={16} /></button>
          </div>
          <div className="dialog__body">{children}</div>
          {footer && <div className="dialog__footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
