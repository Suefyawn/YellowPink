export const dynamic = 'force-dynamic';

import { getBlogPosts } from '@/lib/supabase';
import { BlogPage } from '@/sections/blog/BlogPage';

export default async function BlogListPage() {
  const posts = await getBlogPosts();
  return (
    <main className="fade-in">
      <BlogPage posts={posts} />
    </main>
  );
}
