import { pageMeta } from '@/lib/seo';
import { getBlogPosts } from '@/lib/supabase';
import { BlogPage } from '@/sections/blog/BlogPage';

// 10-min ISR — blog posts publish at most a few times per week.
export const revalidate = 600;

export const metadata = pageMeta({
  title: 'Beauty & wellness journal',
  description:
    'Skin, sleep, and supplement guides from the Yellow Pink editors. Plain-English, evidence-led, no influencer fluff.',
  path: '/blog',
});

export default async function BlogListPage() {
  const posts = await getBlogPosts();
  return (
    <main className="fade-in">
      <BlogPage posts={posts} />
    </main>
  );
}
