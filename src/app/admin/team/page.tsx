import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { supabase } from '@/lib/supabase';
import { TeamPage } from '@/components/admin/TeamPage';

export const metadata = { title: 'Team — Admin' };

export default async function Page() {
  const session = await getStaffSession();
  if (!session?.isOwner) redirect('/admin/dashboard');

  const { data } = await supabase
    .from('staff_members')
    .select('id, email, name, permissions, is_active, created_at')
    .order('created_at', { ascending: true });

  return <TeamPage staff={data ?? []} />;
}
