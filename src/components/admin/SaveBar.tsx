'use client';
// Contextual save bar, Shopify-style: the moment a form has unsaved changes a
// slim ink-dark bar slides down from the top of the viewport — "Unsaved
// changes" on the left, Discard / Save on the right — and the browser warns
// before unloading while edits are pending. Render it inside the form it
// saves (its Save button is type="submit" by default), or point it at a form
// via `formId`, or take over with `onSave`.
//
// Discard reverts to the initially loaded values; the default implementation
// reloads the route (which re-renders every field, uploads and nested editors
// from the server truth) with the beforeunload warning suppressed for that
// one navigation. Pass `onDiscard` to reset in place instead.
import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

const btnBase: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 7,
  fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.2,
  fontFamily: 'inherit', whiteSpace: 'nowrap',
};

export function SaveBar({ dirty, saving, onDiscard, onSave, formId }: {
  /** The form has edits that differ from what was loaded. */
  dirty: boolean;
  /** Submitting right now: disables both buttons, Save reads "Saving…".
   *  Omit to derive it from the surrounding form action (useFormStatus). */
  saving?: boolean;
  /** Revert to the loaded values. Default: reload the route. */
  onDiscard?: () => void;
  /** Custom save handler; otherwise the Save button submits the form. */
  onSave?: () => void;
  /** Submit this form element instead (for a bar rendered outside its form). */
  formId?: string;
}) {
  const status = useFormStatus();
  const isSaving = saving ?? status.pending;
  const show = dirty || isSaving;

  // Keep the bar mounted briefly after `show` drops so it can slide back out.
  const [mounted, setMounted] = useState(show);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (show) { setMounted(true); setLeaving(false); return; }
    setLeaving(true);
    const t = setTimeout(() => { setMounted(false); setLeaving(false); }, 180);
    return () => clearTimeout(t);
  }, [show]);

  // Warn before tab close / refresh / external nav while edits are unsaved.
  // Suppressed while saving (a successful save navigates away itself) and for
  // the deliberate reload a Discard click performs.
  const skipWarnRef = useRef(false);
  useEffect(() => {
    if (!dirty || isSaving) return;
    skipWarnRef.current = false;
    const warn = (e: BeforeUnloadEvent) => {
      if (skipWarnRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, isSaving]);

  if (!mounted) return null;

  const handleDiscard = () => {
    skipWarnRef.current = true;
    if (onDiscard) onDiscard();
    else window.location.reload();
  };
  const handleSave = onSave
    ?? (formId
      ? () => (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit()
      : undefined);

  const saveStyle: React.CSSProperties = {
    ...btnBase,
    background: isSaving ? '#6b7280' : '#C5286A',
    color: 'white', border: '1px solid transparent',
    cursor: isSaving ? 'not-allowed' : 'pointer',
  };

  return (
    <div
      role="status"
      className="adm-contextual-save-bar"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '9px 16px',
        background: '#111827', color: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.28)',
        animation: `${leaving ? 'ypSaveBarOut' : 'ypSaveBarIn'} 0.18s ease both`,
      }}
    >
      <style>{`
        @keyframes ypSaveBarIn  { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes ypSaveBarOut { from { transform: translateY(0); } to { transform: translateY(-100%); } }
        @media (prefers-reduced-motion: reduce) {
          .adm-contextual-save-bar { animation-duration: 0.01s !important; }
        }
      `}</style>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', fontWeight: 600, minWidth: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: '#F7C948' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Unsaved changes
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={isSaving}
          style={{
            ...btnBase,
            background: 'transparent', color: 'white',
            border: '1px solid rgba(255,255,255,0.45)',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          Discard
        </button>
        {handleSave ? (
          <button type="button" onClick={handleSave} disabled={isSaving} style={saveStyle}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        ) : (
          <button type="submit" disabled={isSaving} style={saveStyle}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        )}
      </span>
    </div>
  );
}

// Drop-in <form> for server-component pages (the Settings sub-pages): tracks
// dirtiness from the first edit, shows the contextual bar, and clears the
// dirty flag once the action settles so the bar doesn't linger after the
// saved-redirect. Keeps the host page a server component — only the form
// element itself moves into this client wrapper.
export function SaveBarForm({ action, children }: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);
  return (
    <form
      action={async (formData: FormData) => {
        try { await action(formData); } finally { setDirty(false); }
      }}
      // onInput misses <select> edits in some browsers, onChange misses
      // per-keystroke edits — listen to both (same pairing as ProductForm).
      onInput={markDirty}
      onChange={markDirty}
    >
      {children}
      <SaveBar dirty={dirty} />
    </form>
  );
}
