export function AnnouncementBar({ text, bgColor, textColor }: { text: string; bgColor: string; textColor?: string | null }) {
  const parts = text.split(/(PKR[\s\d,]+)/);
  return (
    <div style={{
      background: bgColor,
      // Respect the authored promo text colour; white is only the default
      // (the settings-driven bar has no text-colour field and the default
      // dark background needs light text).
      color: textColor || '#fff',
      padding: '10px 0',
      textAlign: 'center',
      fontFamily: 'var(--font-ui)',
      fontSize: '0.75rem',
      fontWeight: 500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {parts.map((part, i) =>
        /^PKR/.test(part) ? (
          <span key={i} style={{ borderBottom: '2px solid #F7C948', paddingBottom: 1 }}>{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}
