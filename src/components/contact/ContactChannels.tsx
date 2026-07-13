import { whatsappUrlFromNumber, whatsappGoUrl, WA_TEMPLATES } from '@/lib/whatsapp';
import type { SocialLink } from '@/lib/socials';

// Storefront contact-channel cards, rendered on /page/contact above the form.
// WhatsApp-first (the channel PK shoppers reach for), then call / email / track.
// All values are owner-managed (admin Settings → site_settings); any channel
// with no configured value is omitted rather than rendered as a dead link.

// Brand / channel glyphs. WhatsApp + socials are brand marks (fill); call /
// mail / package are lucide-style strokes. All inherit colour via currentColor.
const ICON: Record<string, React.ReactNode> = {
  whatsapp: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884z" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  track: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  ),
};

const SOCIAL_ICON: Record<string, React.ReactNode> = {
  social_instagram: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  ),
  social_facebook: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  social_tiktok: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.34-1.48z" />
    </svg>
  ),
  social_youtube: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none" />
    </svg>
  ),
  social_twitter: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  social_pinterest: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" />
    </svg>
  ),
  social_whatsapp: ICON.whatsapp,
};

interface Channel {
  key: string;
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  action: string;
  external?: boolean;
  accent?: boolean;
}

export function ContactChannels({
  phone,
  email,
  socials,
}: {
  phone: string | null;
  email: string | null;
  socials: SocialLink[];
}) {
  // Gate on a configured number, but route through the internal redirect
  // (crawler-safe + logs the click) instead of a raw wa.me link.
  const waConfigured = whatsappUrlFromNumber(phone, WA_TEMPLATES.generic()) != null;
  const waHref = waConfigured ? whatsappGoUrl(WA_TEMPLATES.generic(), { src: 'contact' }) : null;
  const telDigits = phone ? phone.replace(/[^\d+]/g, '') : null;

  const channels: Channel[] = [];
  if (waHref) {
    channels.push({
      key: 'whatsapp', href: waHref, icon: ICON.whatsapp, accent: true, external: true,
      title: 'WhatsApp us', sub: 'Fastest reply, usually within a few hours, 7 days a week.',
      action: 'Chat now',
    });
  }
  if (telDigits) {
    channels.push({
      key: 'call', href: `tel:${telDigits}`, icon: ICON.phone,
      title: 'Call us', sub: `${phone} · 10am–8pm PKT, every day.`,
      action: 'Call',
    });
  }
  if (email) {
    channels.push({
      key: 'email', href: `mailto:${email}`, icon: ICON.mail,
      title: 'Email us', sub: `${email} · we reply within one working day.`,
      action: 'Send email',
    });
  }
  channels.push({
    key: 'track', href: '/track', icon: ICON.track,
    title: 'Track your order', sub: 'Already ordered? Check its status instantly, no need to message us.',
    action: 'Track order',
  });

  return (
    <section aria-label="Ways to reach us" style={{ marginTop: 8 }}>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {channels.map(c => (
          <a
            key={c.key}
            href={c.href}
            {...(c.external ? { target: '_blank', rel: 'nofollow noopener noreferrer' } : {})}
            className="contact-channel-card"
            // One emphasis device for the preferred channel: the tinted
            // background (plus the small "Fastest" badge). Border, icon chip
            // and action-link colour are uniform across all four cards so the
            // others don't read as disabled.
            style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', gap: 10,
              padding: '20px 20px 18px', borderRadius: 'var(--radius-card)',
              border: '1px solid var(--line)',
              background: c.accent ? 'color-mix(in srgb, var(--brand-pink-cta) 6%, #fff)' : '#fff',
              textDecoration: 'none', color: 'var(--ink-900)',
              transition: 'box-shadow 150ms, transform 150ms, border-color 150ms',
            }}
          >
            {c.accent && (
              <span style={{
                position: 'absolute', top: 14, right: 14,
                padding: '3px 8px', borderRadius: 999,
                background: 'var(--brand-pink-cta)', color: '#fff',
                fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: 'var(--font-ui)',
              }}>Fastest</span>
            )}
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--paper2)',
                color: 'var(--ink-700)',
              }}
            >{c.icon}</span>
            <span style={{ fontWeight: 600, fontSize: '1.0625rem', fontFamily: 'var(--font-ui)' }}>{c.title}</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--ink-600, var(--ink-700))', lineHeight: 1.5, flexGrow: 1 }}>{c.sub}</span>
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--brand-pink-text)', fontFamily: 'var(--font-ui)',
            }}>{c.action} →</span>
          </a>
        ))}
      </div>

      {socials.length > 0 && (
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--ink-700)', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>
            Follow us
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Social media">
            {socials.map(s => (
              <a
                key={s.key}
                // WhatsApp routes through the robots-blocked /go/whatsapp
                // redirect (same number resolution) — wa.me rate-limits
                // crawlers with 429s, which audits read as a broken external
                // link. Same treatment as the footer social row.
                href={s.key === 'social_whatsapp' ? '/go/whatsapp?src=contact-social' : s.href}
                target="_blank"
                rel={s.key === 'social_whatsapp' ? 'nofollow noopener noreferrer' : 'noopener noreferrer'}
                aria-label={`Yellow Pink on ${s.label}`}
                title={s.label}
                className="contact-social"
                style={{
                  color: 'var(--ink-700)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, borderRadius: 10, border: '1px solid var(--line)',
                  transition: 'color 150ms, background 150ms, border-color 150ms',
                }}
              >
                {SOCIAL_ICON[s.key] ?? <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{s.label.charAt(0)}</span>}
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
