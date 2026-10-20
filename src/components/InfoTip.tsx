import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

// An "i" button with a floating explanation. Tap or click toggles it, hover
// and focus show it, and it never moves the surrounding layout.
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const shown = open || hover;
  return (
    <span className="info-tip-wrap" ref={wrap} onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)} onPointerLeave={() => setHover(false)}>
      <button
        type="button"
        className="info-tip"
        aria-label={label}
        aria-expanded={shown}
        aria-describedby={shown ? id : undefined}
        onClick={() => setOpen(!open)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        i
      </button>
      {shown ? (
        <span id={id} role="tooltip" className="tooltip">
          {children}
        </span>
      ) : null}
    </span>
  );
}
