import type { Metadata } from 'next';
import { getStaffSession } from '@/lib/staff-auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { ToastProvider } from '@/components/admin/Toast';
import { supabaseAdmin } from '@/lib/supabase';
import { can } from '@/lib/permissions';
import { KIND_PERMISSION } from '@/lib/notification-kinds';

interface NotificationRow {
  id: string; kind: string; title: string; body: string | null;
  link: string | null; read: boolean; created_at: string;
}

// Admin PWA identity: its own manifest (scope /admin) so staff can install
// the admin as an app; iOS reads the appleWebApp bits for Add to Home Screen.
export const metadata: Metadata = {
  manifest: '/admin/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'YP Admin', statusBarStyle: 'default' },
  icons: { apple: '/admin/icon-192.png' },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();

  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {children}
      </div>
    );
  }

  // orders + admin_notifications are RLS-locked with no anon SELECT,   // staff-cookie auth doesn't go through Supabase Auth, so the public
  // client returns 0 rows. The badge count and notification feed need
  // the service role.
  const admin = supabaseAdmin();
  const [
    { count: pendingOrderCount },
    { count: unreadMessageCount },
    { count: pendingReturnCount },
    { count: pendingReviewCount },
    { count: pendingQuestionCount },
    { data: rawNotifications },
  ] = await Promise.all([
    // Orders still needing fulfilment, pending OR processing. Matches the
    // Dashboard's "Orders to fulfill" KPI so the two numbers agree.
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']),
    // Unread contact messages, drives the Messages sidebar badge.
    admin
      .from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),
    // Return requests awaiting a decision (same filter as the Dashboard's
    // "Needs attention" card) and reviews awaiting moderation — both get
    // sidebar badges so morning triage doesn't require opening each page.
    admin
      .from('return_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    admin
      .from('product_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('approved', false),
    // Product questions awaiting an answer — the Questions sidebar badge.
    admin
      .from('product_questions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    admin
      .from('admin_notifications')
      .select('id, kind, title, body, link, read, created_at')
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  // Per-viewer notification filter. Owners see everything; managers only see
  // kinds whose KIND_PERMISSION entry they hold (or the kind has no perm
  // requirement). We over-fetch 60 then trim so a low-perm user still gets
  // their ~30 most recent relevant ones.
  const allNotifications = (rawNotifications ?? []) as NotificationRow[];
  const notifications = allNotifications
    .filter(n => {
      const required = KIND_PERMISSION[n.kind];
      if (required === undefined) return true;     // unknown kind, let it through
      if (required === null)      return true;
      return can(session, required);
    })
    .slice(0, 30);

  return (
    <ToastProvider>
      <AdminShell
        session={session}
        pendingOrderCount={pendingOrderCount ?? 0}
        unreadMessageCount={unreadMessageCount ?? 0}
        pendingReturnCount={pendingReturnCount ?? 0}
        pendingReviewCount={pendingReviewCount ?? 0}
        pendingQuestionCount={pendingQuestionCount ?? 0}
        notifications={notifications}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
