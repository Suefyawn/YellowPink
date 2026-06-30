// Pulls the "Frequently asked questions" section out of a blog post's HTML body
// so the post page can (a) render it as a proper accordion (details/summary)
// instead of a wall of headings, and (b) emit FAQPage structured data.
//
// Convention (see the editorial brief): the FAQ block is an <h2> whose text is
// "Frequently asked questions" (or FAQs / Common questions), followed by one
// <h3>Question?</h3> + answer markup per question. The block runs until the
// next <h2>, OR until the closing boilerplate that the posts place right after
// the FAQ, the medical-disclaimer paragraph (which links /medical-review-board)
// and the single `blog-cta` shop button. We must stop at that boilerplate so it
// stays in the prose and is not swallowed into the last answer.
//
// Parsing is forgiving: no FAQ block (or fewer than two parseable questions) →
// the body is returned unchanged and the list is empty.

export interface BlogFaq {
  question: string;
  /** Sanitised answer HTML (kept for rich rendering inside the accordion). */
  answerHtml: string;
  /** Plain-text answer, used for the FAQPage JSON-LD. */
  answerText: string;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…');
}

function toText(html: string): string {
  return decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim();
}

const FAQ_H2_RE =
  /<h2\b[^>]*>\s*(?:<[^>]+>\s*)*(?:frequently asked questions|common questions|faqs?)\b[\s\S]*?<\/h2>/i;
const QA_RE = /<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi;

/** First index in `s` matching `re`, or -1. */
function indexOf(s: string, re: RegExp): number {
  const m = re.exec(s);
  return m ? m.index : -1;
}

/**
 * Extract the FAQ section from `html`.
 * Returns the body with the FAQ heading + Q&A pairs removed (any trailing
 * disclaimer/CTA boilerplate is preserved in place), plus the parsed Q&A list.
 */
export function extractBlogFaq(html: string): { html: string; faqs: BlogFaq[] } {
  if (!html) return { html: html ?? '', faqs: [] };

  const h2 = FAQ_H2_RE.exec(html);
  if (!h2) return { html, faqs: [] };

  const afterH2 = h2.index + h2[0].length;
  const rest = html.slice(afterH2);

  // The FAQ ends at the earliest of: the next <h2>, the closing disclaimer
  // paragraph (links /medical-review-board), or the shop CTA button.
  const bounds = [
    indexOf(rest, /<h2\b/i),
    indexOf(rest, /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?medical-review-board/i),
    indexOf(rest, /<a\b[^>]*class=["'][^"']*blog-cta/i),
  ].filter(i => i !== -1);
  const end = bounds.length ? Math.min(...bounds) : rest.length;
  const inner = rest.slice(0, end);

  const faqs: BlogFaq[] = [];
  let m: RegExpExecArray | null;
  QA_RE.lastIndex = 0;
  while ((m = QA_RE.exec(inner)) !== null) {
    const question = toText(m[1]);
    const answerHtml = m[2].trim();
    const answerText = toText(answerHtml);
    if (question && answerText) faqs.push({ question, answerHtml, answerText });
  }

  // Need at least two real Q&As to bother converting (a lone match is usually a
  // mis-parse). Otherwise leave the body untouched.
  if (faqs.length < 2) return { html, faqs: [] };

  // Drop the FAQ heading + the Q&A inner, keep everything that came after it.
  const cleaned = (html.slice(0, h2.index) + html.slice(afterH2 + end)).replace(/\n{3,}/g, '\n\n');
  return { html: cleaned, faqs };
}
