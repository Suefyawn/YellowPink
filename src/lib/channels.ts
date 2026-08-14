// Shared sales-channel attribution. One mapping from an order's captured
// utm_source / referrer to a friendly channel name, used by BOTH
// Analytics → Sources and Finance → Ad performance (ROAS) so the two
// surfaces can never disagree about what "Facebook" means. Moved out of
// analytics/page.tsx (2026-08-14) when Finance started grouping by the
// same channels instead of raw utm_source strings.

// An order whose attribution resolves to nothing — for a PK storefront this
// overwhelmingly means an Instagram/WhatsApp/typed link that never carried a
// source. Kept visible (not hidden in "other") so tagging links actually
// gets done.
export const UNTAGGED = 'Direct / untagged';

// Friendly names for the sources that actually reach this store. ChatGPT
// (and the other assistants) append ?utm_source=<their domain> to links they
// cite, which is how AI-referred orders identify themselves; search and
// social arrive as referrer hostnames. Anything unrecognised shows raw so
// new sources are visible instead of lumped into an "other" bucket.
export const CHANNEL_NAMES: Record<string, string> = {
  'chatgpt.com': 'ChatGPT', 'chat.openai.com': 'ChatGPT',
  'perplexity.ai': 'Perplexity', 'copilot.microsoft.com': 'Microsoft Copilot',
  'gemini.google.com': 'Google Gemini', 'claude.ai': 'Claude',
  'google.com': 'Google search', 'google': 'Google search',
  'bing.com': 'Bing', 'bing': 'Bing', 'duckduckgo.com': 'DuckDuckGo',
  'facebook': 'Facebook', 'facebook.com': 'Facebook', 'm.facebook.com': 'Facebook', 'fb': 'Facebook',
  'instagram': 'Instagram', 'instagram.com': 'Instagram', 'l.instagram.com': 'Instagram', 'ig': 'Instagram',
  'tiktok': 'TikTok', 'tiktok.com': 'TikTok',
  'whatsapp': 'WhatsApp', 'wa': 'WhatsApp',
};

// The minimum attribution shape a caller must provide; callers with richer
// order rows (utm_campaign, landing_page…) pass them structurally.
export interface ChannelAttribution {
  utm_source?: string | null;
  referrer?: string | null;
}

// Derive a sales channel from an order's captured attribution. utm_source
// wins (a tagged link), else the referrer's host, else UNTAGGED. Kept
// deliberately simple; the point is to make the untagged share visible so
// tagging links (Link builder) actually gets done.
export function channelOf(o: ChannelAttribution): string {
  const s = (o.utm_source ?? '').trim().toLowerCase();
  if (s) return CHANNEL_NAMES[s] ?? s;
  const ref = (o.referrer ?? '').trim();
  if (ref) {
    try {
      const host = new URL(ref).hostname.replace(/^www\./, '');
      return CHANNEL_NAMES[host] ?? host;
    } catch { return ref.slice(0, 40); }
  }
  return UNTAGGED;
}
