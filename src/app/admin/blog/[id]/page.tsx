import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BlogForm, type BlogFormReviewer } from '@/components/admin/BlogForm';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('blog'))) {
    return <NoAccess section="Blog" />;
  }
  const { id } = await params;
  const [{ data: post }, { data: reviewers }] = await Promise.all([
    supabase.from('blog_posts').select('*').eq('id', id).single(),
    supabase.from('content_reviewers').select('id, name, specialty, review_topics, is_default, active').eq('active', true).order('sort_order').order('name'),
  ]);
  if (!post) notFound();
  return <BlogForm post={post} reviewers={(reviewers ?? []) as BlogFormReviewer[]} />;
}
