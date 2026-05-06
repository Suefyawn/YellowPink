export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { deleteBlogPost } from '@/app/admin/actions';
import type { BlogPost } from '@/types';

export default async function BlogAdminPage() {
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('*')
    .order('date', { ascending: false });

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Blog Posts</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>{posts?.length ?? 0} posts</p>
        </div>
        <Link href="/admin/blog/new" style={{
          padding: '10px 20px', background: '#ec4899', color: 'white',
          borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
        }}>
          + New Post
        </Link>
      </div>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {!posts || posts.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No posts yet. <Link href="/admin/blog/new" style={{ color: '#ec4899' }}>Write the first one →</Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Title', 'Category', 'Date', 'Read Time', 'Featured', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(posts as BlogPost[]).map((p, i) => (
                <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '12px 16px', maxWidth: 300 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>{p.slug}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#374151' }}>{p.category}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{p.date}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>{p.read_time}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {p.featured ? (
                      <span style={{ color: '#10b981', fontSize: '1rem' }}>✓</span>
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: '0.875rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link href={`/admin/blog/${p.id}`} style={{
                        padding: '5px 12px', background: '#f3f4f6', color: '#374151',
                        borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500,
                      }}>
                        Edit
                      </Link>
                      <form action={deleteBlogPost} onSubmit={e => { if (!confirm(`Delete "${p.title}"?`)) e.preventDefault(); }}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" style={{
                          padding: '5px 12px', background: '#fef2f2', color: '#dc2626',
                          border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
                        }}>
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
