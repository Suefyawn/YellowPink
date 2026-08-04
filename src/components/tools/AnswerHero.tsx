// Shared tinted hero for the Quick Answers pages: each answer's soft accent
// colour, its icon in a large disc, the friendly name as overline, the
// keyword H1 and its editorial image. Gives the pages a face without
// touching the calculators.

import Image from 'next/image';
import { Overline } from '@/components/ui/Overline';
import { FREE_TOOLS } from '@/lib/free-tools';
import { ToolIcon } from '@/components/tools/ToolCards';

export function AnswerHero({ href, title, intro }: { href: string; title: string; intro: string }) {
  const tool = FREE_TOOLS.find(t => t.href === href);
  const tint = tool?.tint ?? 'var(--paper2, #faf6ee)';
  const accent = tool?.accent ?? 'var(--ink-700)';
  return (
    <section style={{ background: `linear-gradient(180deg, ${tint} 0%, rgba(255,255,255,0) 100%)`, padding: '48px var(--side) 8px' }}>
      {/* flex-wrap two-up: text beside the image on desktop, image dropping
          below the text on phones — no media query needed. */}
      <div className="container" style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '20px 32px', alignItems: 'center' }}>
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <span aria-hidden="true" style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: '#fff', border: `1px solid ${accent}22`,
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: accent,
            }}>
              {tool && <ToolIcon icon={tool.icon} size={28} />}
            </span>
            <div>
              <Overline style={{ display: 'block', marginBottom: 4, color: accent }}>
                {tool?.name ?? 'Quick Answer'} · Free · Nothing leaves your browser
              </Overline>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 4.5vw, 2.25rem)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0 }}>
                {title}
              </h1>
            </div>
          </div>
          <p className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>{intro}</p>
        </div>
        {tool?.image && (
          <div style={{ flex: '1 1 280px', maxWidth: 360, minWidth: 240 }}>
            <Image
              src={tool.image}
              alt={tool.name}
              width={1024}
              height={768}
              priority
              style={{ width: '100%', height: 'auto', maxHeight: 260, objectFit: 'cover', borderRadius: 'var(--radius-card)', boxShadow: '0 10px 30px rgba(0,0,0,0.10)' }}
            />
          </div>
        )}
      </div>
      <div style={{ height: 28 }} />
    </section>
  );
}
