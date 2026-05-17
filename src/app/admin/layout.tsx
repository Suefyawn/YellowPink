import { getStaffSession } from '@/lib/staff-auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { ToastProvider } from '@/components/admin/Toast';
import { supabase } from '@/lib/supabase';

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

  const [{ count: pendingOrderCount }, { data: notifications }] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('admin_notifications')
      .select('id, kind, title, body, link, read, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  return (
    <ToastProvider>
      <AdminShell
        session={session}
        pendingOrderCount={pendingOrderCount ?? 0}
        notifications={(notifications ?? []) as Array<{ id: string; kind: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string }>}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
