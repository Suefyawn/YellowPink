export const dynamic = 'force-dynamic';

// Sales & occasions — the occasions library. Each card is a saved storefront
// "version" (theme + hero + bar + coupon) for one sale of the year; the two
// buttons copy it into the live seasonal settings ("Turn on now") or arm it
// for its dates ("Schedule"). Branding's seasonal card remains the manual
// escape hatch; this page is the yearly one-click path.

import { supabaseAdmin, getSiteSettings } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { STORE_THEMES } from '@/lib/themes';
import { BAR_COLORS, activeSeasonalTheme, parsePktDate } from '@/lib/seasonal-theme';
import type { SaleEvent } from '@/lib/sale-events';
import { activateSaleEventNow, scheduleSaleEvent, turnOffSeason, saveSaleEvent } from './actions';

const themeLabel = (key: string) => STORE_THEMES.find(t => t.key === key)?.label ?? key;

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  return new Date(`${d}T00:00:00+05:00`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'Asia/Karachi',
  });
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return <NoAccess section="Sales & occasions" />;
  }
  const { saved, error } = await searchParams;

  const admin = supabaseAdmin();
  const [{ data }, settings] = await Promise.all([
    admin.from('sale_events').select('*').order('sort_order'),
    getSiteSettings(),
  ]);
  const events = (data ?? []) as SaleEvent[];
  const live = activeSeasonalTheme(settings);
  const scheduledKey = (settings.seasonal_theme ?? '').trim();
  const scheduledStart = parsePktDate(settings.seasonal_theme_start);
  const armedNotLive = Boolean(scheduledKey) && live?.source !== 'scheduled';

  const card: React.CSSProperties = {
    background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 8,
  };
  const btn: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600,
    border: '1px solid #d1d5db', background: 'white', color: '#111827', cursor: 'pointer',
  };
  const primaryBtn: React.CSSProperties = { ...btn, background: '#C5286A', borderColor: '#C5286A', color: 'white' };
  const inp: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.8125rem', color: '#111827', background: 'white', width: '100%', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: '0.05em', display: 'block', marginBottom: 4,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.375rem' }}>Sales &amp; occasions</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem', maxWidth: '60ch' }}>
            Each card is a saved storefront version for one occasion. Turn it on now, or schedule it
            for this year&rsquo;s dates; update the dates once a year for moon-sighting occasions.
            Coupons are not created automatically, set them up in Coupons first.
          </p>
        </div>
        <form action={turnOffSeason}>
          <button type="submit" style={btn}>Turn seasonal look off</button>
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

      <div style={{
        padding: '12px 14px', borderRadius: 8, fontSize: '0.875rem',
        background: live ? (BAR_COLORS[live.key] ?? '#111827') : '#f4f4f5',
        color: live ? 'white' : '#374151',
      }}>
        {live
          ? <>Live now: <strong>{themeLabel(live.key)}</strong> ({live.source === 'scheduled' ? 'scheduled window' : 'switched on manually'})
              {live.message ? <> &middot; bar: &ldquo;{live.message}&rdquo;</> : null}
              {live.coupon ? <> &middot; code {live.coupon}</> : null}</>
          : armedNotLive
            ? <>Nothing live yet. <strong>{themeLabel(scheduledKey)}</strong> is scheduled
                {scheduledStart ? <> to start {scheduledStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' })}</> : null}.</>
            : <>No seasonal look is live, the store wears the year-round yellow &amp; pink.</>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {events.map(ev => {
          const swatch = BAR_COLORS[ev.theme] ?? '#111827';
          const window = ev.starts_on && ev.ends_on
            ? `${fmtDate(ev.starts_on)} to ${fmtDate(ev.ends_on)}`
            : null;
          const isLiveCard = live !== null && live.key === ev.theme
            && (settings.seasonal_theme_message ?? '') === (ev.bar_message ?? '');
          return (
            <div key={ev.id} style={{ ...card, outline: isLiveCard ? `2px solid ${swatch}` : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, background: swatch, flex: 'none' }} />
                <strong style={{ fontSize: '0.9375rem' }}>{ev.name}</strong>
                {isLiveCard && <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', fontWeight: 700, color: swatch }}>LIVE</span>}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                {themeLabel(ev.theme)} theme
                {window ? <> &middot; {window}</> : <> &middot; <em>this year&rsquo;s dates not set</em></>}
              </div>
              {ev.bar_message && (
                <div style={{ fontSize: '0.8125rem', background: swatch, color: 'white', padding: '6px 10px', borderRadius: 6 }}>
                  {ev.bar_message}{ev.bar_coupon ? <strong> &middot; {ev.bar_coupon}</strong> : null}
                </div>
              )}
              {ev.notes && <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>{ev.notes}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                <form action={activateSaleEventNow}>
                  <input type="hidden" name="id" value={ev.id} />
                  <button type="submit" style={primaryBtn}>Turn on now</button>
                </form>
                <form action={scheduleSaleEvent}>
                  <input type="hidden" name="id" value={ev.id} />
                  <button type="submit" style={btn} disabled={!window}
                    title={window ? `Runs itself ${window}` : 'Set this year’s dates first'}>
                    Schedule{window ? '' : ' (needs dates)'}
                  </button>
                </form>
              </div>

              <details>
                <summary style={{ fontSize: '0.8125rem', color: '#C5286A', cursor: 'pointer', fontWeight: 600 }}>
                  Edit dates &amp; copy
                </summary>
                <form action={saveSaleEvent} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  <input type="hidden" name="id" value={ev.id} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><span style={lbl}>Starts (PKT)</span>
                      <input type="date" name="starts_on" defaultValue={ev.starts_on ?? ''} style={inp} /></div>
                    <div><span style={lbl}>Ends (inclusive)</span>
                      <input type="date" name="ends_on" defaultValue={ev.ends_on ?? ''} style={inp} /></div>
                  </div>
                  <div><span style={lbl}>Theme</span>
                    <select name="theme" defaultValue={ev.theme} style={inp}>
                      {STORE_THEMES.filter(t => t.key !== 'default').map(t => (
                        <option key={t.key} value={t.key}>{t.label}</option>
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
                  <div><span style={lbl}>Hero image URL (blank = normal hero image)</span>
                    <input name="hero_image_url" defaultValue={ev.hero_image_url ?? ''} style={inp} maxLength={500}
                      placeholder="Upload via Settings → Branding, or paste a /catalog/… path" /></div>
                  <div>
                    <button type="submit" style={primaryBtn}>Save event</button>
                  </div>
                </form>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
