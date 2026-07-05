'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';
import { addSearchSynonym, deleteSearchSynonym, type SynonymResult } from '@/app/admin/search-demand/synonym-actions';

export interface Synonym { term: string; canonical: string; note: string | null }

const inp: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.8125rem', color: '#111827', background: '#fff', outline: 'none', minWidth: 0,
};
const lbl: React.CSSProperties = { fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, display: 'block' };

function DeleteButton({ term }: { term: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => deleteSearchSynonym(term))}
      style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '3px 9px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', color: '#b91c1c', cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.5 : 1, whiteSpace: 'nowrap' }}
    >
      {pending ? 'Removing…' : 'Remove'}
    </button>
  );
}

export function SynonymManager({ synonyms, prefillTerm }: { synonyms: Synonym[]; prefillTerm?: string }) {
  const [state, action, pending] = useActionState<SynonymResult | null, FormData>(addSearchSynonym, null);
  const formRef = useRef<HTMLFormElement>(null);
  const canonicalRef = useRef<HTMLInputElement>(null);
  // Clear the form after a successful add so the next mapping starts blank.
  // (DOM reset only, no React state, so no cascading render.)
  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);
  // Prefilled from a "+ Synonym" gap-row action: focus where the owner types
  // what to search instead, since the term is already filled.
  useEffect(() => { if (prefillTerm) canonicalRef.current?.focus(); }, [prefillTerm]);

  return (
    <div style={{ padding: '4px 18px 18px' }}>
      <form ref={formRef} action={action} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: synonyms.length ? 18 : 0 }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={lbl} htmlFor="syn-term">When someone searches</label>
          <input id="syn-term" name="term" required defaultValue={prefillTerm ?? ''} placeholder="e.g. vit c" style={{ ...inp, width: '100%' }} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={lbl} htmlFor="syn-canonical">Search this instead</label>
          <input id="syn-canonical" name="canonical" required ref={canonicalRef} placeholder="e.g. vitamin c" style={{ ...inp, width: '100%' }} />
        </div>
        <div style={{ flex: '2 1 180px' }}>
          <label style={lbl} htmlFor="syn-note">Note (optional)</label>
          <input id="syn-note" name="note" placeholder="why" style={{ ...inp, width: '100%' }} />
        </div>
        <button
          type="submit"
          disabled={pending}
          style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#C5286A', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1, whiteSpace: 'nowrap' }}
        >
          {pending ? 'Saving…' : 'Add mapping'}
        </button>
      </form>

      {state?.error && <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#b91c1c' }}>{state.error}</p>}
      {state?.ok && <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#059669' }}>Mapping saved. Searches for that term now return the replacement&apos;s products.</p>}

      {synonyms.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {synonyms.map(s => (
            <div key={s.term} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', border: '1px solid #f3f4f6', borderRadius: 8, background: '#fafafa' }}>
              <span style={{ fontSize: '0.8125rem', color: '#111827' }}>
                <strong>{s.term}</strong>
                <span style={{ color: '#9ca3af', margin: '0 6px' }}>→</span>
                {s.canonical}
                {s.note && <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}> · {s.note}</span>}
              </span>
              <span style={{ marginLeft: 'auto' }}><DeleteButton term={s.term} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
