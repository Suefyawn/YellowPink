export const dynamic = 'force-dynamic';

import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import {
  inp, lbl, Section, Card, Divider, Toggle,
  SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

const PATH = '/admin/settings/loyalty';

export default async function SettingsLoyaltyPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;

  return (
    <>
      <SettingsPageHeader
        title="Loyalty"
        subtitle="How customers earn and redeem loyalty points. Postgres triggers read these on every order, review and signup."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />

        <Card>
          <Section title="Earn & redeem" desc="Live values, the next order or sign-up uses whatever you save here." />
          <Divider />
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Points per PKR spent</label>
              <input name="loyalty_points_per_pkr" type="number" step="0.01" min={0} defaultValue={g('loyalty_points_per_pkr', '0.1')} style={inp} />
            </div>
            <div>
              <label style={lbl}>PKR per point at redemption</label>
              <input name="loyalty_pkr_per_point" type="number" step="0.01" min={0} defaultValue={g('loyalty_pkr_per_point', '1')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Welcome points (signup)</label>
              <input name="loyalty_welcome_points" type="number" min={0} defaultValue={g('loyalty_welcome_points', '100')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Approved review points</label>
              <input name="loyalty_review_points" type="number" min={0} defaultValue={g('loyalty_review_points', '25')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Referrer reward (points)</label>
              <input name="loyalty_referral_points" type="number" min={0} defaultValue={g('loyalty_referral_points', '500')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Referee discount (%)</label>
              <input name="loyalty_referral_discount_pct" type="number" min={0} max={100} defaultValue={g('loyalty_referral_discount_pct', '10')} style={inp} />
            </div>
          </div>
        </Card>

        <Card>
          <Section
            title="Google review bonus"
            desc="Extra points for customers who also review Yellow Pink on Google. Only offer this after their on-site review is approved and positive — the Reviews page shows an 'Ask for Google review' button on approved 4–5★ reviews. Google can't tell us who reviewed, so award the points manually from the customer's page once you see it land."
          />
          <Divider />
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Google review link</label>
              <input
                name="google_review_url"
                type="url"
                placeholder="https://g.page/r/…/review"
                defaultValue={g('google_review_url')}
                style={inp}
              />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                Google Business Profile → Ask for reviews → copy the short link.
              </p>
            </div>
            <div>
              <label style={lbl}>Bonus points</label>
              <input name="loyalty_google_review_points" type="number" min={0} defaultValue={g('loyalty_google_review_points', '100')} style={inp} />
            </div>
          </div>
        </Card>

        <Card>
          <Section
            title="Guest reviewer reward"
            desc="Signed-in customers earn the loyalty points above when a review is approved. Guests (who review with just an email) can't hold points — so when this is on, an approved guest review is emailed a one-time discount code instead. It never double-rewards a signed-in customer."
          />
          <Divider />
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Reward guest reviews</label>
            <Toggle name="review_reward_enabled" checked={g('review_reward_enabled', 'true') === 'true'} />
          </div>
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 360 }}>
            <div>
              <label style={lbl}>Discount (%)</label>
              <input name="review_reward_percent" type="number" min={1} max={100} defaultValue={g('review_reward_percent', '10')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Code valid for (days)</label>
              <input name="review_reward_days" type="number" min={1} defaultValue={g('review_reward_days', '60')} style={inp} />
            </div>
          </div>
        </Card>

        <SaveBar />
      </form>
    </>
  );
}
