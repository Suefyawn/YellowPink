// FAQ round-tripping for the admin editors. Staff type FAQs as alternating
// "Q:" / "A:" lines (friendlier than raw JSON); storage is jsonb [{q,a}].
// Shared by the brand and collection editors so the two cannot drift.

export interface Faq { q: string; a: string }

export function faqsToText(faqs: Faq[] | null | undefined): string {
  return (faqs ?? []).map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');
}

/** Inverse of faqsToText. Tolerates multi-line answers (lines following an
 *  "A:" belong to that answer until the next "Q:") and drops incomplete
 *  pairs rather than emitting half an entry into structured data. */
export function parseFaqs(text: string): Faq[] {
  const faqs: Faq[] = [];
  let q: string | null = null;
  let a: string[] = [];
  const flush = () => {
    if (q && a.length) faqs.push({ q, a: a.join(' ').trim() });
    q = null; a = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (/^q:/i.test(line)) { flush(); q = line.slice(2).trim(); }
    else if (/^a:/i.test(line)) { a = [line.slice(2).trim()]; }
    else if (line && a.length) { a.push(line); }
  }
  flush();
  return faqs;
}
