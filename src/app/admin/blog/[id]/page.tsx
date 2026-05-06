import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BlogForm } from '@/components/admin/BlogForm';

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: post } = await supabase.from('blog_posts').select('*').eq('id', id).single();
  if (!post) notFound();
  return <BlogForm post={post} />;
}
