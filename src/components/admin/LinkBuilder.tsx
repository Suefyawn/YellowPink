'use client';

import { useMemo, useState } from 'react';

// Campaign link builder. Tags a destination URL with UTM parameters so a sale
// that arrives from it can be traced back to the exact post/channel in
// Analytics → Sources. Fixes the "85% Direct" blind spot: Instagram bio,
// WhatsApp and in-app-browser links otherwise arrive with no source at all.
//
// Pure client tool — no data leaves the browser until the owner pastes the
// generated link somewhere. `siteBase` is passed from the server so the
// canonical host (www.yellowpink.pk) is always correct.

interface Preset {
  key: string;
  label: string;
  source: string;
  medium: string;
  hint: string;
}

// Each preset fills source+medium with the conventional pair for that channel,
// so tagging stays consistent (source = where, medium = what kind of link).
const PRESETS: Preset[] = [
  { key: 'ig-bio',    label: 'Instagram bio',   source: 'instagram', medium: 'bio',      hint: 'The single link in your IG profile.' },
  { key: 'ig-story',  label: 'Instagram story',  source: 'instagram', medium: 'story',    hint: 'A story link sticker.' },
  { key: 'ig-post',   label: 'Instagram post',   source: 'instagram', medium: 'social',   hint: 'Feed post / reel caption.' },
  { key: 'whatsapp',  label: 'WhatsApp',         source: 'whatsapp',  medium: 'chat',     hint: 'Broadcasts, status, 1:1 chats.' },
  { key: 'facebook',  label: 'Facebook',         source: 'facebook',  medium: 'social',   hint: 'Page posts.' },
  { key: 'tiktok',    label: 'TikTok',           source: 'tiktok',    medium: 'social',   hint: 'Bio or video.' },
  { key: 'influencer',label: 'Influencer',       source: 'influencer',medium: 'referral', hint: 'Use campaign for their name.' },
  { key: 'email',     label: 'Email',            source: 'newsletter',medium: 'email',    hint: 'Newsletter / broadcast.' },
];

const input: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: '0.875rem', border: '1px solid #d1d5db',
  borderRadius: 8, background: 'white', color: '#111827',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 5,
};

function slug(s: string): string {
  // UTM values should be lowercase, space-free and punctuation-light so the
  // same channel never splits into two rows ("Instagram" vs "instagram").
  return s.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function LinkBuilder({ siteBase }: { siteBase: string }) {
  const [dest, setDest] = useState('/');
  const [source, setSource] = useState('instagram');
  const [medium, setMedium] = useState('bio');
  const [campaign, setCampaign] = useState('');
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [activePreset, setActivePreset] = useState('ig-bio');

  const base = siteBase.replace(/\/$/, '');

  const built = useMemo(() => {
    // Accept either a full URL on our domain or a path; anything else is
    // coerced to a path so the link always points at the storefront.
    let path = dest.trim();
    if (/^https?:\/\//i.test(path)) {
      try { path = new URL(path).pathname + new URL(path).search; } catch { /* keep as-is */ }
    }
    if (!path.startsWith('/')) path = '/' + path;
    const url = new URL(base + path);
    if (source) url.searchParams.set('utm_source', slug(source));
    if (medium) url.searchParams.set('utm_medium', slug(medium));
    if (campaign) url.searchParams.set('utm_campaign', slug(campaign));
    if (content) url.searchParams.set('utm_content', slug(content));
    return url.toString();
  }, [base, dest, source, medium, campaign, content]);

  const ready = Boolean(source && medium);

  function applyPreset(p: Preset) {
    setActivePreset(p.key);
    setSource(p.source);
    setMedium(p.medium);
    setCopied(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(built);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the field is selectable as a fallback */ }
  }

  const card: React.CSSProperties = { background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 24 };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }} className="adm-linkbuilder">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Presets */}
        <div style={card}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            1 · Pick a channel
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.map(p => {
              const on = activePreset === p.key;
              return (
                <button key={p.key} type="button" onClick={() => applyPreset(p)} title={p.hint}
                  style={{
                    padding: '7px 13px', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 999, cursor: 'pointer',
                    border: on ? '1px solid #C5286A' : '1px solid #e5e7eb',
                    background: on ? '#C5286A' : 'white', color: on ? 'white' : '#374151',
                  }}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            {PRESETS.find(p => p.key === activePreset)?.hint ?? 'Choose where this link will live.'}
          </p>
        </div>

        {/* Fields */}
        <div style={card}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>
            2 · Where it points &amp; what to call it
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={lbl} htmlFor="lb-dest">Destination (page on your store)</label>
              <input id="lb-dest" style={input} value={dest} onChange={e => { setDest(e.target.value); setCopied(false); }}
                placeholder="/product/beauty-of-joseon-relief-sun-rice-probiotics-spf50" />
              <p style={{ margin: '5px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>
                Paste a full link or just the path. Base: <code>{base}</code>
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl} htmlFor="lb-source">Source <span style={{ color: '#9ca3af', fontWeight: 400 }}>(where)</span></label>
                <input id="lb-source" style={input} value={source} onChange={e => { setSource(e.target.value); setCopied(false); }} placeholder="instagram" />
              </div>
              <div>
                <label style={lbl} htmlFor="lb-medium">Medium <span style={{ color: '#9ca3af', fontWeight: 400 }}>(type)</span></label>
                <input id="lb-medium" style={input} value={medium} onChange={e => { setMedium(e.target.value); setCopied(false); }} placeholder="bio" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl} htmlFor="lb-campaign">Campaign <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input id="lb-campaign" style={input} value={campaign} onChange={e => { setCampaign(e.target.value); setCopied(false); }} placeholder="eid-sale, ramzan, launch" />
              </div>
              <div>
                <label style={lbl} htmlFor="lb-content">Content <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input id="lb-content" style={input} value={content} onChange={e => { setContent(e.target.value); setCopied(false); }} placeholder="reel-1, banner-a" />
              </div>
            </div>
          </div>
        </div>

        {/* Output */}
        <div style={{ ...card, borderTop: '3px solid #C5286A' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            3 · Copy your tagged link
          </div>
          {ready ? (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
                <input readOnly value={built} onFocus={e => e.currentTarget.select()}
                  style={{ ...input, flex: 1, minWidth: 240, fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem', color: '#C5286A', background: '#fdf2f7' }} />
                <button type="button" onClick={copy}
                  style={{ padding: '9px 20px', fontSize: '0.875rem', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', background: copied ? '#10b981' : '#C5286A', color: 'white', whiteSpace: 'nowrap' }}>
                  {copied ? '✓ Copied' : 'Copy link'}
                </button>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                Use this everywhere you&apos;d normally paste your store link. Any order that starts from it will show up under
                its source in <b>Analytics → Sources</b>.
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>Add a source and medium to generate the link.</p>
          )}
        </div>
      </div>

      {/* Playbook */}
      <aside style={{ ...card, position: 'sticky', top: 20 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#C5286A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Why tag links?
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#4b5563', lineHeight: 1.6 }}>
          Links from Instagram, WhatsApp and in-app browsers arrive with <b>no source</b> — so most of your traffic shows as
          &ldquo;Direct&rdquo; and you can&apos;t tell what&apos;s working.
        </p>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#4b5563', lineHeight: 1.6 }}>
          A tagged link carries its origin all the way to the sale, so you can finally see which post, channel or campaign
          actually earns money.
        </p>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '4px 0 8px' }}>
          Quick rules
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem', color: '#4b5563', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <li><b>Source</b> = the platform (instagram, whatsapp).</li>
          <li><b>Medium</b> = the kind of link (bio, story, email).</li>
          <li><b>Campaign</b> = the push it belongs to (eid-sale).</li>
          <li>Keep names lowercase &amp; consistent — reuse the same words so a channel doesn&apos;t split into two rows.</li>
          <li>Update your Instagram bio link to a tagged one today — it&apos;s the single highest-traffic link you own.</li>
        </ul>
      </aside>
    </div>
  );
}
