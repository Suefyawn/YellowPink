import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';

export default async function AdminLoginPage() {
  const store = await cookies();
  const session = store.get('admin_session')?.value;
  const pass = process.env.ADMIN_PASSWORD;
  if (pass && session === Buffer.from(pass).toString('base64')) {
    redirect('/admin/dashboard');
  }
  return <LoginForm />;
}
