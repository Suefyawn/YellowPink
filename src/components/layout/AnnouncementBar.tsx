// Underline (brand-yellow) hugs the amount only — the regex stops at the last
// digit so a trailing comma/space never picks up the decoration.
function decorated(text: string) {
  return text.split(/(PKR\s?[\d,]*\d)/).map((part, i) =>
    /^PKR/.test(part) ? (
      <span key={i} style={{ borderBottom: '2px solid #F7C948', paddingBottom: 1 }}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function AnnouncementBar({ text, compactText, bgColor, textColor }: {
  text: string;
  /** Optional short phone copy (shown below 480px instead of `text`, see
   *  .announcement-full / .announcement-compact in globals.css). Only passed
   *  for the default free-shipping sentence — owner-authored announcements
   *  render as-is at every width. */
  compactText?: string;
  bgColor: string;
  textColor?: string | null;
}) {
  return (
    <div style={{
      background: bgColor,
      // Respect the authored promo text colour; white is only the default
      // (the settings-driven bar has no text-colour field and the default
      // dark background needs light text).
      color: textColor || '#fff',
      padding: '10px 12px',
      textAlign: 'center',
      fontFamily: 'var(--font-ui)',
      fontSize: '0.75rem',
      fontWeight: 500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      <span className={compactText ? 'announcement-full' : undefined}>{decorated(text)}</span>
      {compactText && (
        <span className="announcement-compact">{decorated(compactText)}</span>
      )}
    </div>
  );
}
