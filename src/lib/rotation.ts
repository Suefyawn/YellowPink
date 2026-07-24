// Daily rail rotation. The homepage rails show 4 tiles from pools of 8-16
// candidates; without rotation the same 4 products own each slot for weeks
// and returning visitors (the store's Facebook-follower core) see a static
// page. True randomness would fight ISR (a different page every 5-minute
// revalidate reads as glitchy and defeats the CDN); instead each PKT day
// gets one deterministic shuffle: stable all day, fresh tomorrow.

/** Days since epoch in Pakistan time — the rotation seed. */
function pktDayNumber(): number {
  const pkt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }); // YYYY-MM-DD
  return Math.floor(Date.parse(`${pkt}T00:00:00Z`) / 86_400_000);
}

/** Cheap deterministic string hash (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pick `count` items from `pool`, shuffled deterministically for today.
 *  `salt` keeps different rails from rotating in lockstep. Pool order is
 *  irrelevant to the result, so ranked pools should be pre-trimmed to the
 *  candidates that deserve the slot (e.g. top 8 sellers) before calling. */
export function dailyRotation<T extends { id: string }>(pool: T[], count: number, salt = ''): T[] {
  if (pool.length <= count) return pool.slice(0, count);
  const day = pktDayNumber();
  return [...pool]
    .sort((a, b) => hash(`${a.id}:${day}:${salt}`) - hash(`${b.id}:${day}:${salt}`))
    .slice(0, count);
}
