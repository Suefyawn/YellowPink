const ALLOWED_TAGS = new Set(['p','br','b','strong','i','em','u','s','ul','ol','li','h2','h3','h4','blockquote','a','span','hr',
  // Comparison tables are core to the long-form blog format. Without these,
  // the sanitizer stripped every <table> and flattened the cells into an
  // unreadable run-on of text. Table elements carry no script surface, so
  // they're safe to allow (their attributes are still stripped below).
  'table','thead','tbody','tfoot','tr','th','td','figure','figcaption','caption',
  // In-body images (1 Sep 2026): the blog editor can now upload and place
  // images inside a post, not just the hero. Sources are restricted to our
  // own hosts below (allowedImageSrc) so an imported body can't hotlink or
  // beacon to third parties.
  'img']);
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  span: ['style'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
};

// Hosts an in-body <img> may load from: the storefront itself, the media CDN
// (R2), and the Supabase storage bucket (legacy uploads). Relative /paths are
// fine too. Anything else drops the whole tag.
const IMG_SRC_OK = /^(\/(?!\/)|https:\/\/(www\.)?yellowpink\.pk\/|https:\/\/images\.yellowpink\.pk\/|https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/)/i;

function dropDisallowedImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, tag => {
    const m = tag.match(/src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const src = m ? (m[1] ?? m[2] ?? m[3] ?? '') : '';
    return IMG_SRC_OK.test(src) ? tag : '';
  });
}

const OWN_HOST = /^https?:\/\/(www\.)?yellowpink\.pk(\/|$)/i;

// Add rel="nofollow noopener noreferrer" + target="_blank" to absolute external
// links in user/imported content (blog bodies, CMS pages). Keeps our own and
// relative links untouched. SEO hygiene: don't pass link equity to, or take
// responsibility for, third-party URLs embedded in content.
function markExternalLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (whole, attrs: string) => {
    const href = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const url = href ? (href[1] ?? href[2] ?? href[3] ?? '') : '';
    if (!/^https?:\/\//i.test(url) || OWN_HOST.test(url)) return whole; // internal/relative

    let out = attrs;
    const relMatch = out.match(/\srel\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const rel = new Set((relMatch ? (relMatch[1] ?? relMatch[2] ?? '') : '').split(/\s+/).filter(Boolean));
    rel.add('nofollow'); rel.add('noopener'); rel.add('noreferrer');
    out = relMatch ? out.replace(relMatch[0], ` rel="${[...rel].join(' ')}"`) : `${out} rel="${[...rel].join(' ')}"`;
    if (!/\starget\s*=/i.test(out)) out += ' target="_blank"';
    return `<a${out}>`;
  });
}

export function sanitizeHtml(raw: string): string {
  const cleaned = raw
    // Strip script/style/iframe tags entirely (including content)
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Strip all event handlers (onclick, onerror, etc.)
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    // Strip javascript: hrefs
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"')
    // Strip tags not in allowlist
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tag: string) => {
      const lower = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(lower)) return '';
      // For allowed tags with specific allowed attrs, strip everything else
      const allowed = ALLOWED_ATTRS[lower] ?? [];
      if (allowed.length === 0) return match.replace(/\s+[a-zA-Z][^=>"'\s]*(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?/g, '');
      return match;
    });
  return markExternalLinks(dropDisallowedImages(cleaned));
}
