// "As featured in" pre-footer strip. Each outlet links to its own site (opens
// in a new tab). On mobile the row stays on a single line — it shrinks and,
// on very narrow phones, scrolls horizontally rather than wrapping.
const CHANNELS: { name: string; url: string }[] = [
  { name: 'ELLE', url: 'https://www.elle.com' },
  { name: 'VOGUE', url: 'https://www.vogue.com' },
  { name: 'DAWN', url: 'https://www.dawn.com' },
  { name: 'GEO', url: 'https://www.geo.tv' },
  { name: 'THE NEWS', url: 'https://www.thenews.com.pk' },
  { name: 'TRIBUNE', url: 'https://tribune.com.pk' },
];

export function PressStrip() {
  return (
    <section style={{ background: 'var(--ink-900)', padding: '24px 0' }} aria-label="As featured in">
      <style>{`
        .press-strip { display: flex; justify-content: center; align-items: center; gap: 48px; flex-wrap: wrap; }
        .press-strip a {
          font-family: var(--font-ui); font-size: 0.75rem; font-weight: 600;
          letter-spacing: 0.2em; text-transform: uppercase; white-space: nowrap;
          color: rgba(250,246,238,0.35); text-decoration: none; transition: color 160ms ease-out;
        }
        .press-strip a:hover { color: rgba(250,246,238,0.85); }
        @media (max-width: 768px) {
          /* One line on phones: don't wrap; tighten gap/type so all six fit,
             and allow horizontal scroll on very narrow screens as a fallback. */
          .press-strip {
            flex-wrap: nowrap; gap: 16px; justify-content: space-between;
            overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
          }
          .press-strip::-webkit-scrollbar { display: none; }
          .press-strip a { font-size: 0.625rem; letter-spacing: 0.12em; }
        }
      `}</style>
      <div className="container press-strip">
        {CHANNELS.map(c => (
          <a key={c.name} href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`${c.name} — opens in a new tab`}>
            {c.name}
          </a>
        ))}
      </div>
    </section>
  );
}
