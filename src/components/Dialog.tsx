import { useEffect, useRef, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react';

export function Dialog({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <dialog ref={ref} className={`dialog ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-content">
      <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={21} /></button></div>
      {children}
    </div>
  </dialog>;
}
