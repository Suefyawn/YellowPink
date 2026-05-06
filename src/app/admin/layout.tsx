import { cookies } from 'next/headers';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const session = store.get('admin_session')?.value;
  const pass = process.env.ADMIN_PASSWORD ?? 'yellowpink2024';
  const isAuth = session === Buffer.from(pass).toString('base64');

  if (!isAuth) {
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6' }}>
      <AdminSidebar />
      <main style={{ flex: 1, marginLeft: 240, minHeight: '100vh', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
