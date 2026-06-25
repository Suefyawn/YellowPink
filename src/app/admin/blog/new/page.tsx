import { BlogForm } from '@/components/admin/BlogForm';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { supabase } from '@/lib/supabase';

export default async function NewBlogPostPage() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('blog'))) {
    return <NoAccess section="Blog" />;
  }
  const { data: reviewers } = await supabase
    .from('content_reviewers').select('id, name, specialty').eq('active', true).order('sort_order').order('name');
  return <BlogForm reviewers={(reviewers ?? []) as { id: string; name: string; specialty: string | null }[]} />;
}
