const ALLOWED_TAGS = new Set(['p','br','b','strong','i','em','u','s','ul','ol','li','h2','h3','h4','blockquote','a','span','hr',
  // Comparison tables are core to the long-form blog format. Without these,
  // the sanitizer stripped every <table> and flattened the cells into an
  // unreadable run-on of text. Table elements carry no script surface, so
  // they're safe to allow (their attributes are still stripped below).
  'table','thead','tbody','tfoot','tr','th','td','figure','figcaption','caption']);
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  span: ['style'],
};

export function sanitizeHtml(raw: string): string {
  return raw
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
}
