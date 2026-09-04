export const dynamic = 'force-dynamic';

// Sales & occasions — THE seasonal control for the storefront (Branding now
// just points here). Modelled on Shopify's Themes page: one "live look"
// panel up top showing exactly what the store wears right now, and a library
// of saved occasion looks below, each a complete pre-stored version (palette,
// announcement bar, hero copy + image, coupon) that publishes with one click.

import { supabaseAdmin } from '@/lib/supabase';
import { getStorefrontSettings } from '@/lib/preview-look';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { STORE_THEMES } from '@/lib/themes';
import { activeSeasonalTheme, parsePktDate } from '@/lib/seasonal-theme';
import { eventActivationState, describeSaleEventCoupon, SALE_EVENT_COUPON_MARK, type SaleEvent } from '@/lib/sale-events';
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

interface CouponRow {
  code: string; active: boolean; type: string; value: number | string; free_shipping: boolean;
  min_order: number | string; starts_at: string | null; expires_at: string | null; used_count: number; description: string | null;
}

const fmtStamp = (iso: string | null) => iso
  ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short' }).format(new Date(iso))
  : null;

/** "DEFENCE · live now, 15% off, 3 used, ends 6 Sep" for the card. */
function couponStatus(ev: SaleEvent, row: CouponRow | undefined, now: Date): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  const code = (ev.bar_coupon ?? '').trim().toUpperCase();
  const terms = describeSaleEventCoupon(ev);
  if (!code) return { text: 'No coupon on this occasion.', tone: 'muted' };
  if (!terms) return { text: `${code}: set a discount value below, or the code will not be created.`, tone: 'warn' };
  if (!row) return { text: `${code} (${terms}): created automatically when this occasion goes live or is scheduled.`, tone: 'muted' };
  const managed = (row.description ?? '').startsWith(SALE_EVENT_COUPON_MARK);
  const startsFuture = row.starts_at ? new Date(row.starts_at) > now : false;
  const expired = row.expires_at ? new Date(row.expires_at) <= now : false;
  const state = !row.active ? 'switched off'
    : expired ? `expired ${fmtStamp(row.expires_at)}`
    : startsFuture ? `opens ${fmtStamp(row.starts_at)}`
    : 'live now';
  const rowTerms = row.free_shipping ? 'free delivery'
    : row.type === 'percent' ? `${Number(row.value)}% off` : `PKR ${Number(row.value).toLocaleString('en-PK')} off`;
  const mismatch = !rowTerms.startsWith(terms.split(',')[0]);
  const bits = [`${code}: ${state}`, rowTerms, `${row.used_count ?? 0} used`];
  if (row.expires_at && !expired && state !== `expired ${fmtStamp(row.expires_at)}`) bits.push(`ends ${fmtStamp(row.expires_at)}`);
  if (!managed) bits.push('created by hand in Coupons; activating adopts it');
  if (mismatch) bits.push(`card says ${terms.split(',')[0]}, will update on activation`);
  return { text: bits.join(' · '), tone: !row.active || expired ? 'warn' : 'ok' };
}

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
  // Storefront-effective settings: includes the autopilot overlay, so this
  // page always describes what shoppers actually see.
  const [{ data }, { settings, auto }] = await Promise.all([
    admin.from('sale_events').select('*').order('sort_order'),
    getStorefrontSettings(),
  ]);
  const events = (data ?? []) as SaleEvent[];
  // Coupon status per occasion: does the advertised code exist, is it live,
  // and does it match the card's discount? Read once for all codes.
  const codes = [...new Set(events.map(e => (e.bar_coupon ?? '').trim().toUpperCase()).filter(Boolean))];
  const { data: couponRows } = codes.length
    ? await admin.from('coupons').select('code, active, type, value, free_shipping, min_order, starts_at, expires_at, used_count, description').in('code', codes)
    : { data: [] as CouponRow[] };
  const couponByCode = new Map((couponRows ?? []).map(c => [String(c.code).toUpperCase(), c as CouponRow]));
  const now = new Date();
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
      ? `${auto ? 'Up next (calendar)' : 'Scheduled'}: ${sourceEvent?.name ?? themeLabel(armedKey)}`
      : 'Year-round Yellow Pink look';
  const liveDetail = live
    ? live.source === 'scheduled'
      ? `${auto ? 'Running from the occasions calendar' : 'Running on its schedule'}${armedEnd ? `, turns itself off after ${armedEnd}` : ''}.`
      : 'Switched on manually — stays on until you turn it off.'
    : armedNotLive
      ? `Turns itself on ${armedStart ?? 'when the window opens'} and off after ${armedEnd ?? 'the window closes'}. Until then the store wears the default look.`
      : 'No occasion is live or scheduled. Occasions with dates run themselves from the calendar; you can also publish any look right now from the library below.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.375rem' }}>Sales &amp; occasions</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem', maxWidth: '64ch' }}>
            Every occasion keeps a complete saved look — colours, announcement bar, hero and image.
            Publish it with one click, or schedule it and it runs itself. The coupon code the bar
            advertises is created with the look and bounded to its dates, so it is never a dead code.
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
                  ? <> &middot; {window}{ev.auto_schedule !== false && <> &middot; runs itself</>}</>
                  : <> &middot; <span style={{ color: '#B45309' }}>set this year&rsquo;s dates to schedule</span></>}
              </div>
              {ev.notes && <div style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>{ev.notes}</div>}
              {(() => {
                const cs = couponStatus(ev, couponByCode.get((ev.bar_coupon ?? '').trim().toUpperCase()), now);
                const color = cs.tone === 'ok' ? '#166534' : cs.tone === 'warn' ? '#B45309' : '#6b7280';
                return (
                  <div style={{ fontSize: '0.75rem', color, lineHeight: 1.5, padding: '6px 8px', background: '#faf6ee', borderRadius: 6 }}>
                    <span style={{ fontWeight: 700 }}>Coupon</span> &middot; {cs.text}
                  </div>
                );
              })()}

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
                  <div style={{ padding: '10px 12px', background: '#faf6ee', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827' }}>Coupon (publishes with the look)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10 }}>
                      <div><span style={lbl}>Code shown in the bar</span>
                        <input name="bar_coupon" defaultValue={ev.bar_coupon ?? ''} style={inp} maxLength={40}
                          placeholder="e.g. EIDI (blank = no coupon)" /></div>
                      <div><span style={lbl}>Discount</span>
                        <select name="coupon_type" defaultValue={ev.coupon_type ?? 'percent'} style={inp}>
                          <option value="percent">Percent off</option>
                          <option value="fixed">Fixed PKR off</option>
                          <option value="free_shipping">Free delivery</option>
                        </select></div>
                      <div><span style={lbl}>Value</span>
                        <input type="number" name="coupon_value" min={0} step="1" defaultValue={String(ev.coupon_value ?? 10)} style={inp} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div><span style={lbl}>Min order (PKR)</span>
                        <input type="number" name="coupon_min_order" min={0} step="1" defaultValue={String(ev.coupon_min_order ?? 0)} style={inp} /></div>
                      <div><span style={lbl}>Per customer</span>
                        <input type="number" name="coupon_per_user" min={1} step="1" defaultValue={ev.coupon_per_user ?? ''} style={inp} placeholder="unlimited" /></div>
                      <div><span style={lbl}>Total uses</span>
                        <input type="number" name="coupon_max_uses" min={1} step="1" defaultValue={ev.coupon_max_uses ?? ''} style={inp} placeholder="unlimited" /></div>
                    </div>
                    <label style={{ fontSize: '0.75rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" name="coupon_exclude_sale_items" defaultChecked={Boolean(ev.coupon_exclude_sale_items)} />
                      Skip items already on sale (discount applies to full-price lines only)
                    </label>
                    <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                      Turn on now, Schedule and the calendar all create or update this code in Coupons, valid for exactly the occasion&rsquo;s dates. Turning the look off switches the code off.
                    </div>
                  </div>
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
                  <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" name="auto_schedule" defaultChecked={ev.auto_schedule !== false} />
                    Runs itself every cycle over its dates (untick to keep it manual-only)
                  </label>
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
