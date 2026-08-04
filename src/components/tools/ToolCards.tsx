// Shared tool-card grid used by the /tools hub and the homepage band.
// Server-component friendly: plain links, inline lucide-style icons
// (house icon rules: 24×24 viewBox, stroke=currentColor, strokeWidth 2).

import Link from 'next/link';
import { FREE_TOOLS, type FreeTool } from '@/lib/free-tools';

export function ToolIcon({ icon, size = 18 }: { icon: FreeTool['icon']; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[icon]}
    </svg>
  );
}

const ICON_PATHS: Record<FreeTool['icon'], React.ReactNode> = {
  heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  baby: <><path d="M9 12h.01" /><path d="M15 12h.01" /><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2-2 2c-.8 0-1.5-.4-1.5-1" /></>,
  scale: <><path d="M16 16.5a4 4 0 0 1-8 0" /><path d="M12 3v3" /><circle cx="12" cy="12" r="9" /></>,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3 1.072-2.143 2.5-3.736 4.5-5 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  sparkles: <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z" /></>,
};

export function ToolCards({ compact = false, tools = FREE_TOOLS }: { compact?: boolean; tools?: FreeTool[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 200 : 240}px, 1fr))`, gap: compact ? 12 : 'var(--gutter)' }}>
      {tools.map(tool => (
        <Link
          key={tool.href}
          href={tool.href}
          style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            background: '#fff', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: compact ? '18px 18px 16px' : '24px 22px 20px',
            textDecoration: 'none', color: 'inherit',
          }}
        >
          <span aria-hidden="true" style={{
            width: 38, height: 38, borderRadius: 10,
            background: tool.tint,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: tool.accent,
          }}>
            <ToolIcon icon={tool.icon} />
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: compact ? '1rem' : '1.0625rem', letterSpacing: '-0.01em' }}>
            {tool.name}
          </span>
          <span className="small-text" style={{ color: 'var(--ink-700)' }}>{tool.blurb}</span>
        </Link>
      ))}
    </div>
  );
}
