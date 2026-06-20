// Maps an admin Orders-filter "range" chip to a `created_at` lower-bound ISO
// string. Shared by the server page (the actual query) and the client CSV
// export button so the two can never disagree on what a chip means.
//
//   1d  → "Today": the current calendar day in the store's market timezone
//          (Pakistan, fixed UTC+5, no DST), i.e. since local midnight. A
//          rolling 24h window would surprise an operator who clicks "Today"
//          in the morning and sees yesterday-afternoon's orders.
//   7d / 30d / 90d → rolling "last N days" windows (the conventional reading
//          of "Last 7 days").
//
// Returns null for an empty / unknown / "all" range (no time filter).

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Karachi is a fixed UTC+5.
const DAY_MS = 86_400_000;
const ROLLING_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

export function orderRangeSinceIso(range: string | undefined | null, now: number = Date.now()): string | null {
  if (!range || range === 'all') return null;

  if (range === '1d') {
    // Floor "now" to the start of the current PKT calendar day, then express
    // that boundary back in UTC for the created_at comparison.
    const startOfPktDayUtc = Math.floor((now + PKT_OFFSET_MS) / DAY_MS) * DAY_MS - PKT_OFFSET_MS;
    return new Date(startOfPktDayUtc).toISOString();
  }

  const days = ROLLING_DAYS[range];
  return days ? new Date(now - days * DAY_MS).toISOString() : null;
}
