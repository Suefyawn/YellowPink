'use client';

// Renders a computed routine: the step sections with per-pick reasons, the
// add-whole-routine CTA, share/save actions, the matching buyer guides and
// the email capture. Used by the live quiz results AND the saved-result page
// (/quiz/r/[code]) so both stay identical.

import { useRef, useState } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { useCart } from '@/context/CartContext';
import { ProductTile } from '@/components/ui/ProductTile';
import { Overline } from '@/components/ui/Overline';
import { captureQuizEmail, type RoutineResult } from '@/app/quiz/actions';

function capture(name: string, props?: Record<string, unknown>) {
  try { posthog.capture(name, props); } catch { /* posthog not ready, ignore */ }
}

const WhatsAppIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
  </svg>
);

const LinkIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export function RoutineView({ routine, onRetake }: { routine: RoutineResult; onRetake?: () => void }) {
  const { addToCart, setCartOpen } = useCart();
  const sessionId = useRef<string>('');
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);

  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [emailMsg, setEmailMsg] = useState('');

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/quiz/r/${routine.code}`
    : `/quiz/r/${routine.code}`;

  // Main picks only (not the alternates); variable products need a shade
  // choice on their own page, so they're linked rather than force-added.
  const mainPicks = routine.sections.map(s => s.picks[0]).filter(Boolean);
  const addable = mainPicks.filter(p =>
    p.product.kind !== 'variable' && (p.product.track_inventory === false || p.product.stock > 0));

  const addRoutine = () => {
    let count = 0;
    for (const pick of addable) {
      if (addToCart({ ...pick.product, qty: 1 })) count++;
    }
    if (count > 0) {
      setAdded(true);
      setCartOpen(true);
      capture('quiz_routine_added_to_cart', { count, code: routine.code });
    }
  };

  const shareWhatsApp = () => {
    capture('quiz_result_shared', { channel: 'whatsapp', code: routine.code });
    const text = `${routine.headline} from Yellow Pink: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      capture('quiz_result_shared', { channel: 'copy', code: routine.code });
    } catch { /* clipboard unavailable */ }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId.current) sessionId.current = crypto.randomUUID();
    setEmailState('sending'); setEmailMsg('');
    const res = await captureQuizEmail(sessionId.current, email, routine.code);
    if (!res.ok) { setEmailState('error'); setEmailMsg(res.error ?? 'Please try again.'); return; }
    setEmailState('done');
    capture('quiz_email_captured', { code: routine.code });
  };

  const actionBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px',
    background: 'none', border: '1px solid var(--line)', borderRadius: 8,
    cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--ink-700)',
    fontFamily: 'var(--font-ui)', textDecoration: 'none',
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.625rem', fontWeight: 500, margin: '0 0 6px' }}>
        {routine.headline}
      </h2>
      <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 8 }}>
        Every pick below is matched to your answers, with the reason next to it.
        Your plan is saved at this link, so you can come back to it any time:
      </p>
      <p className="small-text" style={{ color: 'var(--ink-500)', marginBottom: 24, wordBreak: 'break-all' }}>
        {shareUrl}
      </p>

      {routine.sections.map((s, i) => (
        <section key={s.key} style={{ marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span aria-hidden="true" style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--brand-pink-text, #C5286A)', color: '#fff',
              fontSize: '0.75rem', fontWeight: 700, transform: 'translateY(4px)',
            }}>{i + 1}</span>
            <Overline style={{ color: 'var(--ink-900)', fontSize: '0.8125rem' }}>{s.label}</Overline>
          </div>
          <p className="small-text" style={{ color: 'var(--ink-500)', margin: '0 0 14px 34px' }}>{s.note}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 20, marginLeft: 34 }}>
            {s.picks.map(pick => (
              // Flex column so ProductTile's internal height:100% resolves
              // against the tile area and the why-line stacks cleanly below
              // (a plain div let the caption collide with the next section).
              <div key={pick.product.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <ProductTile product={pick.product} />
                <p className="small-text" style={{ color: 'var(--ink-500)', margin: '8px 0 0', lineHeight: 1.45 }}>
                  {pick.why}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 26 }}>
        {addable.length > 0 && (
          <button type="button" onClick={addRoutine} className="btn-primary" style={{ padding: '11px 22px' }}>
            {added ? 'Added ✓' : `Add ${addable.length > 1 ? `all ${addable.length} picks` : 'my pick'} to cart`}
          </button>
        )}
        <button type="button" onClick={shareWhatsApp} style={actionBtn}>
          <WhatsAppIcon /> Share on WhatsApp
        </button>
        <button type="button" onClick={copyLink} style={actionBtn}>
          <LinkIcon /> {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {/* Matching guides */}
      {routine.guides.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <Overline style={{ display: 'block', marginBottom: 10, color: 'var(--ink-500)' }}>Worth reading</Overline>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {routine.guides.map(g => (
              <li key={g.slug}>
                <Link href={`/blog/${g.slug}`} className="text-link" style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Email opt-in (optional) */}
      {emailState === 'done' ? (
        <div role="status" style={{ padding: '16px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, color: '#166534', marginBottom: 20 }}>
          ✓ Sent! Your routine and a welcome discount are on the way to your inbox.
        </div>
      ) : (
        <form onSubmit={submitEmail} style={{ padding: '18px 20px', background: 'var(--paper2)', border: '1px solid var(--line)', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Email me this plan, with a welcome discount</div>
          <p className="small-text" style={{ color: 'var(--ink-500)', margin: '0 0 12px' }}>
            Exactly these picks, the reasons, and your saved link. No spam.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="email" inputMode="email" autoComplete="email" required value={email}
              onChange={e => setEmail(e.target.value)} disabled={emailState === 'sending'}
              placeholder="you@example.com"
              style={{ flex: '1 1 220px', minWidth: 0, padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.9375rem', outline: 'none', background: '#fff' }}
            />
            <button type="submit" disabled={emailState === 'sending'} className="btn-primary" style={{ padding: '11px 20px' }}>
              {emailState === 'sending' ? 'Sending…' : 'Email my plan'}
            </button>
          </div>
          {emailState === 'error' && <p role="alert" style={{ color: 'var(--error)', fontSize: '0.8125rem', margin: '8px 0 0' }}>{emailMsg}</p>}
        </form>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/shop" style={{ ...actionBtn, border: 'none', textDecoration: 'underline' }}>Shop all products</Link>
        {onRetake ? (
          <button type="button" onClick={onRetake} style={actionBtn}>Retake quiz</button>
        ) : (
          <Link href="/quiz" style={actionBtn}>Take the quiz yourself</Link>
        )}
      </div>
    </div>
  );
}
