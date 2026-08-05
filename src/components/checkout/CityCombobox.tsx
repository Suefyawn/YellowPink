'use client';

// In-app city suggestions replacing the native <datalist>, which browsers
// render as an unstylable popup (dark, detached, stacked under Chrome's
// autofill overlay — the Aug 5 owner screenshot). ARIA combobox per APG:
// the listbox is absolutely positioned inside a relative wrapper so it can
// never detach from the input, and option taps use pointerdown-preventDefault
// so blur can't close the list before the tap lands. Free text stays legal —
// suggestions help, they never gate.

import { useId, useRef, useState } from 'react';

export function CityCombobox({
  id, value, cities, onChange, onBlurNormalize, inputStyle, invalid, describedBy,
}: {
  id: string;
  value: string;
  /** Already filtered by the caller (e.g. to the selected province). */
  cities: string[];
  onChange: (val: string) => void;
  onBlurNormalize: (val: string) => void;
  inputStyle: React.CSSProperties;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const matches = (q ? cities.filter(c => c.toLowerCase().startsWith(q)) : cities).slice(0, 8);
  const show = open && matches.length > 0;

  function select(city: string) {
    onChange(city);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!show && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return; }
    if (!show) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); select(matches[active]); } }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        id={id}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        name="city"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={e => { setOpen(false); setActive(-1); onBlurNormalize(e.target.value); }}
        onKeyDown={onKeyDown}
        placeholder="e.g. Lahore"
        style={inputStyle}
      />
      {show && (
        <ul
          id={listId}
          role="listbox"
          aria-label="City suggestions"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
            margin: 0, padding: 6, listStyle: 'none',
            background: 'var(--paper, #fff)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-1, 0 8px 24px rgba(0,0,0,0.10))',
            maxHeight: '40vh', overflowY: 'auto',
          }}
        >
          {matches.map((c, i) => (
            <li
              key={c}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // pointerdown fires before the input's blur — preventDefault
              // keeps focus (and the list) alive until the click selects.
              onPointerDown={e => e.preventDefault()}
              onClick={() => select(c)}
              onMouseEnter={() => setActive(i)}
              style={{
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                fontSize: '0.875rem',
                background: i === active ? 'var(--paper2, #faf6ee)' : 'transparent',
              }}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
