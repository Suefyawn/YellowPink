import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin/AdminShell';
import { ToastProvider } from '@/components/admin/Toast';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const session = store.get('admin_session')?.value;
  const pass = process.env.ADMIN_PASSWORD;
  const isAuth = pass ? session === Buffer.from(pass).toString('base64') : false;

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
    <ToastProvider>
      <AdminShell>{children}</AdminShell>
    </ToastProvider>
  );
}
