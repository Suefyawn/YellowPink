import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { ProfilePage } from '@/components/admin/ProfilePage';

export const metadata = { title: 'My Profile — Admin' };

export default async function Page() {
  const session = await getStaffSession();
  if (!session) redirect('/admin');
  if (session.isOwner) redirect('/admin/dashboard'); // owner has no profile page

  return <ProfilePage name={session.name} email={session.email} />;
}
