import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { adminHomeFor } from '@/lib/admin-nav';
import { supabaseAdmin } from '@/lib/supabase';
import { TeamPage } from '@/components/admin/TeamPage';

export const metadata = { title: 'Team, Admin' };

export default async function Page() {
  const session = await getStaffSession();
  if (!session) redirect('/admin');
  if (!session.isOwner) redirect(adminHomeFor(session));

  const [{ data: staff }, { data: roles }] = await Promise.all([
    supabaseAdmin()
      .from('staff_members')
      .select('id, email, name, permissions, is_active, created_at, role_id, totp_enabled, last_login_at')
      .order('created_at', { ascending: true }),
    supabaseAdmin()
      .from('roles')
      .select('id, name, description, permissions, is_system')
      .order('name', { ascending: true }),
  ]);

  // The owner signs in with the store password (no staff row) — surface that
  // account on the Team page so the strongest credential isn't invisible.
  const ownerEmail = process.env.OWNER_EMAIL?.trim() || null;

  return <TeamPage staff={staff ?? []} roles={roles ?? []} ownerEmail={ownerEmail} />;
}
