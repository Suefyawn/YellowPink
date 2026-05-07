export function AnnouncementBar({ text, bgColor }: { text: string; bgColor: string }) {
  const parts = text.split(/(PKR[\s\d,]+)/);
  return (
    <div style={{
      background: bgColor,
      color: '#fff',
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
