// Shared form primitives for the split Settings pages. The monolithic
// /admin/settings page used to inline these; extracted here so each
// sub-page (profile, branding, homepage, …) reuses the same building
// blocks without copy-paste drift.

import type { CSSProperties, ReactNode } from 'react';

export const inp: CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

export const lbl: CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600,
  color: '#374151', marginBottom: 5,
};

export function Section({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <h2 style={{ margin: '0 0 2px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>{desc}</p>
    </div>
  );
}

export function Toggle({ name, checked }: { name: string; checked: boolean }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <input type="hidden" name={name} value="false" />
      <input type="checkbox" name={name} value="true" defaultChecked={checked}
        style={{ width: 18, height: 18, accentColor: '#C5286A', cursor: 'pointer' }} />
      <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>Enabled</span>
    </label>
  );
}

export function ColorPicker({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input type="color" name={name} defaultValue={value}
        style={{ width: 40, height: 36, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
      <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{label}</span>
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #f0f0f3', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)', padding: '24px', marginBottom: 20 }}>
      {children}
    </div>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: '#f3f4f6', margin: '20px 0' }} />;
}

// `configured` mirrors the Integrations page's env-var check: undefined =
// no gateway needed (COD), true/false renders a live status chip so the
// enabled/working distinction is visible where the money decision is made —
// checkout hides gateway methods whose credentials are missing, so a ticked
// but unconfigured method silently never reaches customers.
export function PayMethodRow({ name, checked, label, desc, configured }: { name: string; checked: boolean; label: string; desc: string; configured?: boolean }) {
  return (
    <label
      htmlFor={`set-${name}`}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 16px', borderRadius: 8,
        background: '#fafafa', border: '1px solid #f3f4f6',
        cursor: 'pointer',
      }}
    >
      <div style={{ paddingTop: 2 }}>
        <input type="hidden" name={name} value="false" />
        <input
          id={`set-${name}`}
          type="checkbox"
          name={name}
          value="true"
          defaultChecked={checked}
          style={{ width: 18, height: 18, accentColor: '#C5286A', cursor: 'pointer' }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{label}</span>
          {configured != null && (
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: configured ? '#f0fdf4' : '#fef3c7',
              color: configured ? '#15803d' : '#92400e',
            }}>
              {configured ? 'Gateway configured' : 'Not configured — hidden at checkout'}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </label>
  );
}

export function StatusBanner({ saved, saveError }: { saved: boolean; saveError?: string }) {
  if (saved) {
    return (
      <div style={{
        background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
        padding: '12px 16px', marginBottom: 24, color: '#15803d',
        fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>✓</span> Settings saved, changes are live on the site.
      </div>
    );
  }
  if (saveError) {
    return (
      <div style={{
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
        padding: '12px 16px', marginBottom: 24, color: '#dc2626',
        fontSize: '0.875rem', fontWeight: 500,
      }}>
        Save failed: {saveError}
      </div>
    );
  }
  return null;
}

// Fixed bottom save bar. Each sub-page form ends with one of these so the
// Save button is always reachable regardless of form length. Full-width and
// opaque so it never floats translucently over form fields; the horizontal
// offset (clear of the sidebar on desktop, edge-to-edge on phones, lifted
// above the bottom nav) comes from the .adm-save-bar / .adm-sticky-actions
// rules in AdminShell, and .adm-settings-layout reserves matching bottom
// padding so every field can scroll clear of it.
export function SaveBar() {
  return (
    <div className="adm-sticky-actions adm-save-bar" style={{
      position: 'fixed', right: 0, bottom: 0, zIndex: 40,
      padding: '12px 20px',
      background: '#ffffff',
      borderTop: '1px solid #e5e7eb',
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      boxShadow: '0 -6px 18px rgba(0,0,0,0.06)',
    }}>
      <button type="submit" className="adm-settings-save-btn" style={{
        padding: '11px 28px', background: '#C5286A', color: 'white',
        border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9375rem',
        cursor: 'pointer', transition: 'background 0.15s ease',
      }}>
        Save changes
      </button>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>
        Changes apply immediately to the live site.
      </p>
    </div>
  );
}

// Page header used at the top of every Settings sub-page.
export function SettingsPageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{title}</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '0.875rem' }}>{subtitle}</p>
    </>
  );
}
