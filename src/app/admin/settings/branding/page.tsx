export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getSiteSettings } from '@/lib/supabase';
import { saveSettings, saveSeasonalTheme } from '../actions';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { STORE_THEMES, normalizeTheme } from '@/lib/themes';
import { activeSeasonalTheme, parsePktDate } from '@/lib/seasonal-theme';
import {
  inp, lbl, Section, Card, Divider, ColorPicker,
  StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';
import { SaveBarForm } from '@/components/admin/SaveBar';

const PATH = '/admin/settings/branding';

// Seasonal card state, derived from the backing keys so the form always
// reflects what the storefront is actually doing.
function seasonalFormState(s: Record<string, string>) {
  const scheduledKey = (s.seasonal_theme ?? '').trim();
  const manualOn = s.season_active === 'true' && normalizeTheme(s.active_theme) !== 'default';
  const mode: 'off' | 'now' | 'schedule' = scheduledKey ? 'schedule' : manualOn ? 'now' : 'off';
  const theme = scheduledKey
    || (normalizeTheme(s.active_theme) !== 'default' ? normalizeTheme(s.active_theme) : 'independence');
  return { mode, theme };
}

const fmtPkt = (value: string | undefined) => {
  const d = parsePktDate(value);
  if (!d) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(d) + ' PKT';
};

const themeLabel = (key: string) => STORE_THEMES.find(t => t.key === key)?.label ?? key;

export default async function SettingsBrandingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;
  const { mode, theme } = seasonalFormState(s);
  const active = activeSeasonalTheme(s);
  const startLabel = fmtPkt(g('seasonal_theme_start'));
  const endLabel = fmtPkt(g('seasonal_theme_end'));

  // One honest sentence about what the storefront is doing right now.
  const status = active
    ? {
        color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0',
        text: active.source === 'scheduled'
          ? `Live now: ${themeLabel(active.key)} (scheduled${endLabel ? `, turns itself off ${endLabel}` : ''}).`
          : `Live now: ${themeLabel(active.key)} (manual — stays on until you switch it off).`,
      }
    : mode === 'schedule'
      ? {
          color: '#92400e', bg: '#fffbeb', border: '#fde68a',
          text: `Scheduled: ${themeLabel(theme)} turns on ${startLabel ?? 'when the window opens'} and off ${endLabel ?? 'when it closes'}. The storefront wears the default look until then.`,
        }
      : {
          color: '#4b5563', bg: '#f9fafb', border: '#e5e7eb',
          text: 'No seasonal theme active — the storefront wears the default Yellow Pink look.',
        };

  const radio = (value: 'off' | 'now' | 'schedule', title: string, desc: string) => (
    <label style={{
      display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px',
      border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', background: 'white',
    }}>
      <input type="radio" name="seasonal_mode" value={value} defaultChecked={mode === value}
        style={{ marginTop: 3, accentColor: '#C5286A' }} />
      <span>
        <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{title}</span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{desc}</span>
      </span>
    </label>
  );

  return (
    <>
      <SettingsPageHeader
        title="Branding & theme"
        subtitle="Brand colours, and the seasonal makeover: pick a theme, choose when it runs, and the palette, announcement bar and homepage hero all follow."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      {/* Seasonal theme card — its own form + action: the form speaks in one
          mental model (a theme + when it runs) and saveSeasonalTheme maps it
          to the backing keys, so the switches can't contradict each other.
          SaveBarForm shows the contextual "Unsaved changes" bar (with the
          Save button) the moment any field is edited, Shopify-style. */}
      <SaveBarForm action={saveSeasonalTheme}>
        <Card>
          <Section
            title="Seasonal theme"
            desc="One theme, one decision about when it runs. While a theme is active the storefront wears its colours and background motif, the announcement bar shows your event message, and the homepage hero swaps to the seasonal copy below. Everything reverts to the default look the moment it ends."
          />
          <Divider />
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 10, fontSize: '0.8125rem', fontWeight: 600,
              color: status.color, background: status.bg, border: `1px solid ${status.border}`,
            }}>
              {status.text}
            </div>

            <div>
              <label style={lbl} htmlFor="set-seasonal-theme-pick">Theme</label>
              <select id="set-seasonal-theme-pick" name="seasonal_theme_pick" defaultValue={theme} style={inp}>
                {STORE_THEMES.filter(t => t.key !== 'default').map(t => (
                  <option key={t.key} value={t.key}>{t.label} — {t.hint}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={lbl}>When does it run?</label>
              <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                {radio('off', 'Off', 'Default look. The dates and copy below are kept for next time.')}
                {radio('now', 'On now', 'Switches the theme on immediately and keeps it on until you come back and turn it off. Good for a quick preview too.')}
                {radio('schedule', 'Scheduled', 'Turns itself on at the start time and off at the end time — nothing to remember. Times are Pakistan time.')}
              </div>
            </div>

            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Starts (PKT)</label>
                <input type="datetime-local" name="seasonal_theme_start" defaultValue={g('seasonal_theme_start')} style={inp} />
              </div>
              <div>
                <label style={lbl}>Ends (PKT)</label>
                <input type="datetime-local" name="seasonal_theme_end" defaultValue={g('seasonal_theme_end')} style={inp} />
              </div>
            </div>
            <p style={{ margin: '-8px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
              Only used with Scheduled. Storefront pages are cached, so a flip reaches every visitor within a few minutes.
            </p>

            <div>
              <label style={lbl}>Announcement-bar message</label>
              <input name="seasonal_theme_message" defaultValue={g('seasonal_theme_message')} style={inp}
                placeholder="Azadi Sale is live: 14% off storewide with code AZADI14" />
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                Shown in the theme-coloured bar at the top of every page while the theme is active. Leave blank for no bar (palette and hero only).
              </p>
            </div>
            <div>
              <label style={lbl}>Coupon code shown in the bar</label>
              <input name="seasonal_theme_coupon" defaultValue={g('seasonal_theme_coupon')} style={inp}
                placeholder="AZADI14" />
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                Display only — create or edit the code itself on the <Link href="/admin/coupons" style={{ color: '#C5286A', fontWeight: 600 }}>Coupons</Link> page.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 2 }}>
                Seasonal homepage hero
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: '#9ca3af' }}>
                Replaces the homepage hero while the theme is active. Leave a field blank to keep your normal hero&apos;s value for it.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={lbl}>Overline (small label above headline)</label>
                  <input name="season_hero_overline" defaultValue={g('season_hero_overline')} style={inp}
                    placeholder="14 August · Jashn e Azadi" />
                </div>
                <div>
                  <label style={lbl}>Headline</label>
                  <textarea name="season_hero_headline" defaultValue={g('season_hero_headline').replace(/<br\/>/g, '\n')} rows={2} style={{ ...inp, resize: 'vertical' }}
                    placeholder="Azadi Sale." />
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                    Use a new line where you want a line break. Italics with HTML: &lt;em&gt;text&lt;/em&gt;
                  </p>
                </div>
                <div>
                  <label style={lbl}>Sub-text</label>
                  <textarea name="season_hero_subline" defaultValue={g('season_hero_subline')} rows={3} style={{ ...inp, resize: 'vertical' }} />
                </div>
                <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Button text</label>
                    <input name="season_hero_cta1_text" defaultValue={g('season_hero_cta1_text')} style={inp}
                      placeholder="Shop the Azadi Sale" />
                  </div>
                  <div>
                    <label style={lbl}>Button URL</label>
                    <input name="season_hero_cta1_url" defaultValue={g('season_hero_cta1_url')} style={inp}
                      placeholder="/shop" />
                  </div>
                </div>
                <div>
                  <ImageUpload name="season_hero_image_url" currentUrl={g('season_hero_image_url')} label="Seasonal hero image" aspect={4 / 3} />
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                    Recommended 800×700px or taller. Leave blank to keep your normal hero image.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </SaveBarForm>

      {/* Brand colours keep the generic settings action — unrelated to the
          seasonal mapping above, so they save independently, via their own
          inline button (a second contextual bar on one page would overlap). */}
      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />
        <Card>
          <Section
            title="Brand colours"
            desc="Used by emails and storefront accents. CSS variables in globals.css are the source of truth for the storefront; these copies are for email + future theming."
          />
          <Divider />
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Brand pink</label>
              <ColorPicker name="brand_pink"   value={g('brand_pink',   '#E8487F')} label="Primary" />
            </div>
            <div>
              <label style={lbl}>Brand yellow</label>
              <ColorPicker name="brand_yellow" value={g('brand_yellow', '#F7C948')} label="Accent" />
            </div>
            <div>
              <label style={lbl}>Ink</label>
              <ColorPicker name="ink_900"      value={g('ink_900',      '#111827')} label="Text" />
            </div>
          </div>
          <button type="submit" style={{
            padding: '10px 22px', background: 'white', color: '#C5286A',
            border: '1px solid #C5286A', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
          }}>
            Save brand colours
          </button>
        </Card>
      </form>
    </>
  );
}
