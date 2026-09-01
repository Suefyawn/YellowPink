export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import { STORE_THEMES, normalizeTheme } from '@/lib/themes';
import { activeSeasonalTheme, parsePktDate } from '@/lib/seasonal-theme';
import {
  lbl, Section, Card, Divider, ColorPicker,
  StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

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

  return (
    <>
      <SettingsPageHeader
        title="Branding & theme"
        subtitle="Brand colours here; the seasonal makeover now lives in Sales & occasions, where every occasion keeps its complete pre-stored look."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      {/* Seasonal status only — control moved to Sales & occasions (owner
          ask, 1 Sep 2026: one place, pre-stored looks, one-click switch).
          This card just says what the storefront is doing and links there. */}
      <Card>
        <Section
          title="Seasonal look"
          desc="The storefront's seasonal makeover — palette, announcement bar, hero and image — is managed from Sales & occasions, where every occasion keeps a complete pre-stored version you can preview and publish with one click."
        />
        <Divider />
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{
            padding: '10px 14px', borderRadius: 10, fontSize: '0.8125rem', fontWeight: 600,
            color: status.color, background: status.bg, border: `1px solid ${status.border}`,
          }}>
            {status.text}
          </div>
          <div>
            <Link href="/admin/sales" style={{
              display: 'inline-block', padding: '9px 18px', background: '#C5286A', color: 'white',
              borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none',
            }}>
              Open Sales &amp; occasions
            </Link>
          </div>
        </div>
      </Card>

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
