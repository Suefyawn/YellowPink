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

// Add rel="noopener noreferrer" + target="_blank" to absolute external links
// in editorial content (blog bodies, CMS pages). Keeps our own and relative
// links untouched.
//
// No nofollow. Until 5 Sep 2026 every external link was also nofollowed,
// which is the right default for content we do not vouch for (comments,
// paid placements). The bodies that pass through here are staff-written
// guides whose ~290 outbound links cite Cleveland Clinic, the NHS, Mayo,
// NIH, WHO and the like; those citations are part of the E-E-A-T case, and
// Google's guidance is to reserve nofollow for links you cannot vouch for.
// Nofollowing every source also lit up the Semrush audit (808 "nofollow
// external links"). A rel the editor wrote (sponsored, nofollow) is kept.
function markExternalLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (whole, attrs: string) => {
    const href = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const url = href ? (href[1] ?? href[2] ?? href[3] ?? '') : '';
    if (!/^https?:\/\//i.test(url) || OWN_HOST.test(url)) return whole; // internal/relative

    let out = attrs;
    const relMatch = out.match(/\srel\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const rel = new Set((relMatch ? (relMatch[1] ?? relMatch[2] ?? '') : '').split(/\s+/).filter(Boolean));
    rel.add('noopener'); rel.add('noreferrer');
    out = relMatch ? out.replace(relMatch[0], ` rel="${[...rel].join(' ')}"`) : `${out} rel="${[...rel].join(' ')}"`;
    if (!/\starget\s*=/i.test(out)) out += ' target="_blank"';
    return `<a${out}>`;
  });
}

// Attribute tokens, in the three shapes HTML permits: name="value",
// name='value', name=value (unquoted), and a bare boolean name. The unquoted
// form is the one the event-handler passes miss, so it has to be parsed here
// rather than pattern-matched away.
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/g;

/** Rebuild an allowed tag carrying only its allowlisted attributes, with every
 *  value re-quoted so nothing can leak out of the attribute it sits in. */
function rebuildTag(match: string, tag: string, allowed: string[]): string {
  if (match.startsWith('</')) return `</${tag}>`;
  const allow = new Set(allowed);
  // Everything between the tag name and the closing '>' (or '/>').
  const inner = match.slice(1 + tag.length + 1).replace(/\/?>$/, '');
  const kept: string[] = [];
  for (const m of inner.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (!allow.has(name)) continue;
    const value = m[2] ?? m[3] ?? m[4];
    // A bare boolean attribute keeps its name; anything with a value is
    // re-emitted double-quoted, with quotes and angle brackets escaped.
    kept.push(value === undefined ? name : `${name}="${escapeAttr(value)}"`);
  }
  const selfClosing = /\/>$/.test(match);
  return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}${selfClosing ? ' /' : ''}>`;
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          .replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
      // For allowed tags with specific allowed attrs, strip everything else.
      const allowed = ALLOWED_ATTRS[lower] ?? [];
      if (allowed.length === 0) return match.replace(/\s+[a-zA-Z][^=>"'\s]*(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?/g, '');
      // Tags that DO allow attributes used to be returned untouched, which
      // meant <a>, <span> and <img> kept every attribute an author wrote.
      // The two event-handler passes above only match QUOTED handlers, so an
      // unquoted one survived the whole sanitizer:
      //   <span onmouseover=alert(1)>  →  unchanged
      //   <span onmouseover="alert(1)"> →  stripped
      // Anyone with CMS or blog-API write access could therefore store script
      // that ran for every reader, because these bodies are rendered through
      // dangerouslySetInnerHTML. Enforce the allowlist instead of trusting it.
      return rebuildTag(match, lower, allowed);
    });
  return markExternalLinks(dropDisallowedImages(cleaned));
}
