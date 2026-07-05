import { BlogForm, type BlogFormReviewer } from '@/components/admin/BlogForm';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { supabase } from '@/lib/supabase';

export default async function NewBlogPostPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('blog'))) {
    return <NoAccess section="Blog" />;
  }
  // Optional ?title= seeds the post title (Search-demand "Write a guide").
  const { title } = await searchParams;
  const { data: reviewers } = await supabase
    .from('content_reviewers').select('id, name, specialty, review_topics, is_default, active').eq('active', true).order('sort_order').order('name');
  return <BlogForm reviewers={(reviewers ?? []) as BlogFormReviewer[]} initialTitle={title?.slice(0, 160)} />;
}
