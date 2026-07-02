export const dynamic = 'force-dynamic';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';

// Renders docs/USER-MANUAL.md inside the admin so any staff member can read
// how the store + storefront work. The markdown file stays the single source
// of truth (project rule: keep the manual accurate); this page reads it at
// request time rather than duplicating its content. The file is force-included
// in the serverless trace for this route via `outputFileTracingIncludes` in
// next.config.ts, without that, fs can't find it on Vercel.
export default async function AdminHelpPage() {
  // Staff-only: the manual is internal operating documentation. getStaffSession
  // returns null when unauthenticated, so bounce anonymous hits to the login.
  const session = await getStaffSession();
  if (!session) redirect('/admin');

  let html = '';
  let error = false;
  try {
    const md = await readFile(path.join(process.cwd(), 'docs', 'USER-MANUAL.md'), 'utf8');
    html = await marked.parse(md, { gfm: true, breaks: false });
  } catch {
    error = true;
  }

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>User manual</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
          How the storefront works and how to run the store. This is the same manual that ships with the
          codebase (<code>docs/USER-MANUAL.md</code>), it&apos;s kept up to date as features change.
        </p>
      </div>

      {error ? (
        <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 24, color: '#6b7280', fontSize: '0.875rem' }}>
          The manual couldn&apos;t be loaded right now. It lives at <code>docs/USER-MANUAL.md</code> in the
          repository.
        </div>
      ) : (
        <article
          className="yp-manual"
          style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '32px 36px', maxWidth: 920 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {/* Scoped typographic styles for the rendered markdown. Kept inline so the
          page is self-contained and doesn't touch the global admin stylesheet. */}
      <style>{`
        .yp-manual { color: #1f2937; font-size: 0.9375rem; line-height: 1.65; max-width: 100%; }
        .yp-manual > :first-child { margin-top: 0; }
        .yp-manual h1, .yp-manual h2, .yp-manual h3, .yp-manual h4 { color: #111827; font-weight: 700; line-height: 1.25; }
        .yp-manual h1 { font-size: 1.6rem; margin: 0 0 8px; }
        .yp-manual h2 { font-size: 1.25rem; margin: 32px 0 12px; padding-top: 16px; border-top: 1px solid #f3f4f6; }
        .yp-manual h3 { font-size: 1.05rem; margin: 24px 0 8px; }
        .yp-manual h4 { font-size: 0.95rem; margin: 18px 0 6px; }
        .yp-manual p { margin: 0 0 12px; }
        .yp-manual ul, .yp-manual ol { margin: 0 0 12px; padding-left: 22px; }
        .yp-manual li { margin: 3px 0; }
        .yp-manual a { color: #C5286A; text-decoration: underline; }
        /* overflow-wrap lets long unbreakable inline code (URLs, env vars)
           wrap instead of pushing the page wider than the viewport. */
        .yp-manual code { background: #f3f4f6; border-radius: 4px; padding: 1px 5px; font-size: 0.85em; overflow-wrap: anywhere; }
        .yp-manual pre { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; overflow-x: auto; max-width: 100%; }
        .yp-manual pre code { background: none; padding: 0; }
        .yp-manual img { max-width: 100%; height: auto; }
        .yp-manual blockquote { margin: 0 0 14px; padding: 8px 16px; border-left: 3px solid #f9a8d4; background: #fdf2f8; color: #6b7280; border-radius: 0 6px 6px 0; }
        .yp-manual blockquote p { margin: 0; }
        .yp-manual hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
        /* display:block + overflow-x lets wide manual tables scroll inside
           their own box instead of pushing the page past the viewport. */
        .yp-manual table { display: block; width: 100%; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 0 0 18px; font-size: 0.875rem; }
        .yp-manual th, .yp-manual td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; }
        .yp-manual th { background: #f9fafb; font-weight: 600; color: #374151; }
        .yp-manual tr:nth-child(even) td { background: #fcfcfd; }
      `}</style>
    </div>
  );
}
