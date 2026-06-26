/** Remove emoji / pictographs (and the variation selectors + ZWJ that join
 *  them) from a string, collapsing any whitespace left behind. Used to keep
 *  our outbound comms, order emails, WhatsApp messages, emoji-free even when
 *  a customer's own name carries an emoji (e.g. "Ultron 🤖" → "Ultron"). It
 *  sanitises the rendered copy only; stored customer data is untouched. */
export function stripEmoji(s: string): string {
  return s
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
