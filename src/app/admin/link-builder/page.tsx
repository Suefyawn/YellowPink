import { getStaffSession } from '@/lib/staff-auth';
import { canAny } from '@/lib/permissions';
import { NoAccess } from '@/components/admin/NoAccess';
import { LinkBuilder } from '@/components/admin/LinkBuilder';
import { SITE_URL } from '@/lib/seo';

// Campaign link builder — generates UTM-tagged storefront links so sales can be
// attributed by source in Analytics → Sources. A marketing/measurement tool, so
// it's visible to anyone who does marketing or reads analytics.
export default async function LinkBuilderPage() {
  const session = await getStaffSession();
  if (!session || !canAny(session, ['analytics', 'newsletter', 'coupons'])) {
    return <NoAccess section="Link builder" />;
  }

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Campaign link builder</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 640 }}>
          Make tagged links for Instagram, WhatsApp and campaigns so every visit — and every sale — traces back to where it
          came from. Then read the results in <b>Analytics → Sources</b>.
        </p>
      </div>
      <LinkBuilder siteBase={SITE_URL} />
    </div>
  );
}
