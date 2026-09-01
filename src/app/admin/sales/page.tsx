export const dynamic = 'force-dynamic';

// Sales & occasions — THE seasonal control for the storefront (Branding now
// just points here). Modelled on Shopify's Themes page: one "live look"
// panel up top showing exactly what the store wears right now, and a library
// of saved occasion looks below, each a complete pre-stored version (palette,
// announcement bar, hero copy + image, coupon) that publishes with one click.

import { supabaseAdmin, getSiteSettings } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { STORE_THEMES } from '@/lib/themes';
import { activeSeasonalTheme, parsePktDate } from '@/lib/seasonal-theme';
import { eventActivationState, type SaleEvent } from '@/lib/sale-events';
import { LookPreview } from '@/components/admin/LookPreview';
import { ImageUpload } from '@/components/admin/ImageUpload';
import {
  activateSaleEventNow, scheduleSaleEvent, turnOffSeason,
  saveSaleEvent, createSaleEvent, deleteSaleEvent,
} from './actions';

const themeLabel = (key: string) => STORE_THEMES.find(t => t.key === key)?.label ?? key;

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  return new Date(`${d}T00:00:00+05:00`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'Asia/Karachi',
  });
}

const fmtPkt = (value: string | undefined) => {
  const d = parsePktDate(value);
  if (!d) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi', day: 'numeric', month: 'short',
  }).format(d);
};

// ── shared styles ───────────────────────────────────────────────────────────
const btn: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600,
  border: '1px solid #d1d5db', background: 'white', color: '#111827', cursor: 'pointer',
};
const primaryBtn: React.CSSProperties = { ...btn, background: '#C5286A', borderColor: '#C5286A', color: 'white' };
const dangerBtn: React.CSSProperties = { ...btn, color: '#B01E5C', borderColor: '#F3C6D8' };
const inp: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.8125rem', color: '#111827', background: 'white', width: '100%', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 4,
};
const badge = (bg: string, color: string): React.CSSProperties => ({
  fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px',
  borderRadius: 999, background: bg, color, textTransform: 'uppercase', whiteSpace: 'nowrap',
});

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; edit?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return <NoAccess section="Sales & occasions" />;
  }
  const { saved, error, edit } = await searchParams;

  const admin = supabaseAdmin();
  const [{ data }, settings] = await Promise.all([
    admin.from('sale_events').select('*').order('sort_order'),
    getSiteSettings(),
  ]);
  const events = (data ?? []) as SaleEvent[];
  const live = activeSeasonalTheme(settings);
  const sourceKey = (settings.seasonal_source_event ?? '').trim();
  const sourceEvent = events.find(ev => ev.key === sourceKey) ?? null;
  const armedKey = (settings.seasonal_theme ?? '').trim();
  const armedNotLive = Boolean(armedKey) && live?.source !== 'scheduled';
  const armedStart = fmtPkt(settings.seasonal_theme_start);
  const armedEnd = fmtPkt(settings.seasonal_theme_end);

  // The live panel shows the settings as the storefront resolves them —
  // which equals the source event's saved fields (edits propagate on save).
  const liveHeading = live
    ? `Live now: ${sourceEvent?.name ?? `${themeLabel(live.key)} (custom look)`}`
    : armedNotLive
      ? `Scheduled: ${sourceEvent?.name ?? themeLabel(armedKey)}`
      : 'Year-round Yellow Pink look';
  const liveDetail = live
    ? live.source === 'scheduled'
      ? `Running on its schedule${armedEnd ? `, turns itself off after ${armedEnd}` : ''}.`
      : 'Switched on manually — stays on until you turn it off.'
    : armedNotLive
      ? `Turns itself on ${armedStart ?? 'when the window opens'} and off after ${armedEnd ?? 'the window closes'}. Until then the store wears the default look.`
      : 'No occasion is live or scheduled. Publish one from the library below.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.375rem' }}>Sales &amp; occasions</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem', maxWidth: '64ch' }}>
            Every occasion keeps a complete saved look — colours, announcement bar, hero and image.
            Publish it with one click, or schedule it and it runs itself. Coupons are display-only
            here: create the code itself in Coupons.
          </p>
        </div>
        <form action={createSaleEvent} style={{ display: 'flex', gap: 8 }}>
          <input name="name" placeholder="New occasion name…" style={{ ...inp, width: 190 }} maxLength={80} required />
          <button type="submit" style={btn}>Add</button>
        </form>
      </div>

      {saved && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#E7F5EC', color: '#166534', fontSize: '0.875rem' }}>
          {saved}
        </div>
      )}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FBE3EC', color: '#B01E5C', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* ── The live look ── */}
      <div style={{
        background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16,
        display: 'grid', gridTemplateColumns: 'minmax(0, 380px) 1fr', gap: 18, alignItems: 'start',
      }}>
        <LookPreview
          size="full"
          theme={live ? live.key : armedNotLive ? armedKey : 'default'}
          barMessage={(live || armedNotLive) ? settings.seasonal_theme_message : ''}
          barCoupon={(live || armedNotLive) ? settings.seasonal_theme_coupon : ''}
          heroOverline={(live || armedNotLive) ? settings.season_hero_overline : ''}
          heroHeadline={(live || armedNotLive) ? settings.season_hero_headline : ''}
          heroSubline={(live || armedNotLive) ? settings.season_hero_subline : ''}
          ctaText={(live || armedNotLive) ? settings.season_hero_cta1_text : ''}
          imageUrl={(live || armedNotLive) ? settings.season_hero_image_url : settings.hero_image_url}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '1rem' }}>{liveHeading}</strong>
            {live && <span style={badge('#E7F5EC', '#166534')}>Live</span>}
            {armedNotLive && <span style={badge('#FEF3C7', '#92400E')}>Scheduled</span>}
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', maxWidth: '52ch' }}>{liveDetail}</p>
          {(live || armedNotLive) && (
            <form action={turnOffSeason}>
              <button type="submit" style={btn}>Turn seasonal look off</button>
            </form>
          )}
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', maxWidth: '52ch' }}>
            Storefront pages are cached, a change reaches every visitor within a few minutes.
            Editing the {live ? 'live' : armedNotLive ? 'scheduled' : ''} occasion below updates
            the storefront automatically.
          </p>
        </div>
      </div>

      {/* ── The library ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
        {events.map(ev => {
          const state = eventActivationState(ev, settings);
          const isLive = state === 'live' || (state === 'scheduled' && live?.source === 'scheduled');
          const window = ev.starts_on && ev.ends_on
            ? `${fmtDate(ev.starts_on)} – ${fmtDate(ev.ends_on)}`
            : null;
          return (
            <div key={ev.id} style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12,
              display: 'flex', flexDirection: 'column', gap: 10,
              outline: isLive ? '2px solid #166534' : state === 'scheduled' ? '2px solid #D97706' : undefined,
            }}>
              <LookPreview
                theme={ev.theme}
                barMessage={ev.bar_message}
                barCoupon={ev.bar_coupon}
                heroOverline={ev.hero_overline}
                heroHeadline={ev.hero_headline}
                heroSubline={ev.hero_subline}
                ctaText={ev.hero_cta1_text}
                imageUrl={ev.hero_image_url}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: '0.9375rem' }}>{ev.name}</strong>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {isLive && <span style={badge('#E7F5EC', '#166534')}>Live</span>}
                  {state === 'scheduled' && !isLive && <span style={badge('#FEF3C7', '#92400E')}>Scheduled</span>}
                </span>
              </div>
              <div style={{ fontSize: '0.78125rem', color: '#6b7280' }}>
                {themeLabel(ev.theme)} theme
                {window
                  ? <> &middot; {window}</>
                  : <> &middot; <span style={{ color: '#B45309' }}>set this year&rsquo;s dates to schedule</span></>}
              </div>
              {ev.notes && <div style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>{ev.notes}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                <form action={activateSaleEventNow}>
                  <input type="hidden" name="id" value={ev.id} />
                  <button type="submit" style={primaryBtn}>Turn on now</button>
                </form>
                <form action={scheduleSaleEvent}>
                  <input type="hidden" name="id" value={ev.id} />
                  <button type="submit" style={btn} disabled={!window}
                    title={window ? `Runs itself ${window}` : 'Set this year’s dates first (Edit below)'}>
                    Schedule
                  </button>
                </form>
                <a href={`/api/theme-preview?key=${encodeURIComponent(ev.key)}`} target="_blank" rel="noreferrer"
                  style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}
                  title="Open the real storefront wearing this look — only you see it">
                  Preview
                </a>
              </div>

              <details open={edit === ev.key}>
                <summary style={{ fontSize: '0.8125rem', color: '#C5286A', cursor: 'pointer', fontWeight: 600 }}>
                  Edit this look
                </summary>
                <form action={saveSaleEvent} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  <input type="hidden" name="id" value={ev.id} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><span style={lbl}>Starts (PKT)</span>
                      <input type="date" name="starts_on" defaultValue={ev.starts_on ?? ''} style={inp} /></div>
                    <div><span style={lbl}>Ends (inclusive)</span>
                      <input type="date" name="ends_on" defaultValue={ev.ends_on ?? ''} style={inp} /></div>
                  </div>
                  <div><span style={lbl}>Theme (colours &amp; motif)</span>
                    <select name="theme" defaultValue={ev.theme} style={inp}>
                      {STORE_THEMES.filter(t => t.key !== 'default').map(t => (
                        <option key={t.key} value={t.key}>{t.label} — {t.hint}</option>
                      ))}
                    </select></div>
                  <div><span style={lbl}>Announcement bar</span>
                    <input name="bar_message" defaultValue={ev.bar_message ?? ''} style={inp} maxLength={160} /></div>
                  <div><span style={lbl}>Coupon code shown in the bar</span>
                    <input name="bar_coupon" defaultValue={ev.bar_coupon ?? ''} style={inp} maxLength={40}
                      placeholder="Create the code in Coupons first" /></div>
                  <div><span style={lbl}>Hero overline</span>
                    <input name="hero_overline" defaultValue={ev.hero_overline ?? ''} style={inp} maxLength={80} /></div>
                  <div><span style={lbl}>Hero headline (new line = line break)</span>
                    <textarea name="hero_headline" rows={2}
                      defaultValue={(ev.hero_headline ?? '').replace(/<br\/>/g, '\n')}
                      style={{ ...inp, resize: 'vertical' }} /></div>
                  <div><span style={lbl}>Hero subline</span>
                    <textarea name="hero_subline" rows={2} defaultValue={ev.hero_subline ?? ''}
                      style={{ ...inp, resize: 'vertical' }} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><span style={lbl}>Button text</span>
                      <input name="hero_cta1_text" defaultValue={ev.hero_cta1_text ?? ''} style={inp} maxLength={40} /></div>
                    <div><span style={lbl}>Button link</span>
                      <input name="hero_cta1_url" defaultValue={ev.hero_cta1_url ?? ''} style={inp} maxLength={300} /></div>
                  </div>
                  <div>
                    <ImageUpload name="hero_image_url" currentUrl={ev.hero_image_url ?? ''}
                      label="Hero image (blank = normal hero image)" aspect={4 / 3} />
                  </div>
                  <div><span style={lbl}>Notes (only staff see this)</span>
                    <textarea name="notes" rows={2} defaultValue={ev.notes ?? ''}
                      style={{ ...inp, resize: 'vertical' }} maxLength={500}
                      placeholder="Date rules, discount policy for this day…" /></div>
                  <div>
                    <button type="submit" style={primaryBtn}>
                      {state ? 'Save & update the storefront' : 'Save'}
                    </button>
                  </div>
                </form>
                {!state && (
                  <form action={deleteSaleEvent} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                    <input type="hidden" name="id" value={ev.id} />
                    <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" name="confirm" value="yes" /> yes, remove this occasion
                    </label>
                    <button type="submit" style={{ ...dangerBtn, marginLeft: 'auto' }}>Delete</button>
                  </form>
                )}
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
