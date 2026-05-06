export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="12" r="6" fill="var(--brand-yellow)" opacity="0.9" />
      <circle cx="16" cy="12" r="6" fill="var(--brand-pink)" opacity="0.9" />
    </svg>
  );
}
