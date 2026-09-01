// Reading-time derivation for blog posts. One rule shared by the admin form
// path and the automation API so the two can never disagree: strip the HTML,
// count words, 200 wpm, floor of 1 minute. Used whenever read_time arrives
// blank — the writer no longer has to guess "7 min read" by hand.

export function deriveReadTime(bodyHtml: string | null | undefined): string {
  const text = (bodyHtml ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}
