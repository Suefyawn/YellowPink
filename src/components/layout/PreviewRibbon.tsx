// Fixed ribbon shown only to the staff member previewing a seasonal look
// (draft-mode request; see src/lib/preview-look.ts). Regular visitors never
// get this in their HTML. Plain anchors — the exit route clears the state.

export function PreviewRibbon({ name }: { name: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#111827', color: 'white', padding: '10px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
      fontSize: '0.8125rem', flexWrap: 'wrap',
    }}>
      <span>
        <strong>Previewing: {name}.</strong> Only you can see this — the store still shows the published look.
      </span>
      <a href="/admin/sales" style={{ color: '#F7C948', fontWeight: 700, textDecoration: 'underline' }}>
        Publish it in Sales &amp; occasions
      </a>
      <a href="/api/theme-preview/exit" style={{
        color: 'white', fontWeight: 700, border: '1px solid rgba(255,255,255,0.5)',
        borderRadius: 6, padding: '4px 12px', textDecoration: 'none',
      }}>
        Exit preview
      </a>
    </div>
  );
}
