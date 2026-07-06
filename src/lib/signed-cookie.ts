// HMAC-signed cookie payloads, using Web Crypto so the same helper runs
// in both Node (server actions, getStaffSession) and Edge (middleware /
// proxy.ts).
//
// Payload shape: `<base64url(json)>.<base64url(hmac)>`.
// Verification rejects an expired payload (>maxAgeSec) and any signature
// that fails constant-time compare.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  // btoa works in both Node 16+ and Edge.
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function timingSafeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface SignedPayload {
  /** Subject, what this cookie identifies (e.g. 'owner'). */
  sub: string;
  /** Issued-at, epoch seconds. */
  iat: number;
}

export async function sign(payload: Omit<SignedPayload, 'iat'> & Partial<Pick<SignedPayload, 'iat'>>, secret: string): Promise<string> {
  const full: SignedPayload = { sub: payload.sub, iat: payload.iat ?? Math.floor(Date.now() / 1000) };
  const body = enc.encode(JSON.stringify(full));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, body as BufferSource));
  return `${b64urlEncode(body)}.${b64urlEncode(sig)}`;
}

export async function verify(token: string, secret: string, maxAgeSec: number): Promise<SignedPayload | null> {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const bodyB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  let body: Uint8Array, sig: Uint8Array;
  try {
    body = b64urlDecode(bodyB64);
    sig = b64urlDecode(sigB64);
  } catch { return null; }
  const key = await hmacKey(secret);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, body as BufferSource));
  if (!timingSafeEq(expected, sig)) return null;
  let payload: SignedPayload;
  try {
    payload = JSON.parse(dec.decode(body)) as SignedPayload;
  } catch { return null; }
  if (typeof payload.iat !== 'number') return null;
  if (Math.floor(Date.now() / 1000) - payload.iat > maxAgeSec) return null;
  return payload;
}

/** Reused by middleware + server-side session readers. The legacy owner
 *  cookie uses sub='owner' and a 7-day TTL. */
export const OWNER_COOKIE_NAME = 'admin_session';
export const OWNER_COOKIE_TTL_SEC = 60 * 60 * 24 * 7;

/** Staff session TTL — single source shared by staff-auth (cookie maxAge +
 *  Node-side verify) and the Edge verifier below. */
export const STAFF_COOKIE_TTL_SEC = 10 * 60 * 60; // 10h

/** Edge-compatible verification of the staff_session token minted by
 *  lib/staff-auth.ts signToken(): base64url("<staffId>|<epoch>|<issuedMs>|<hexSig>")
 *  where hexSig = HMAC-SHA256("<staffId>|<epoch>|<issuedMs>", secret). A legacy
 *  pre-epoch cookie has the 2-field payload "<staffId>|<issuedMs>".
 *
 *  Returns the staffId on a valid, unexpired signature, else null. This
 *  deliberately does NOT hit the database (Edge can't, cheaply) — the page
 *  layer still re-verifies and loads the staff row; this check exists so a
 *  forged/expired cookie can't get past the middleware gate at all. */
export async function verifyStaffTokenEdge(token: string, secret: string): Promise<string | null> {
  let decoded: string;
  try {
    decoded = dec.decode(b64urlDecode(token));
  } catch { return null; }
  const lastPipe = decoded.lastIndexOf('|');
  if (lastPipe === -1) return null;
  const payload = decoded.slice(0, lastPipe);
  const sigHex = decoded.slice(lastPipe + 1);
  if (!/^[0-9a-f]{64}$/.test(sigHex)) return null;
  const key = await hmacKey(secret);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload) as BufferSource));
  const got = new Uint8Array(32);
  for (let i = 0; i < 32; i++) got[i] = parseInt(sigHex.slice(i * 2, i * 2 + 2), 16);
  if (!timingSafeEq(expected, got)) return null;
  // Payload fields, matching staff-auth.ts verifyToken(): the issued-at
  // timestamp is the LAST field — the 3rd for a current id|epoch|issuedMs
  // token, the 2nd for a legacy id|issuedMs one. Reading the 2nd field
  // unconditionally grabbed the epoch (always "0") on current tokens, so the
  // age check computed ~55 years and rejected every live staff cookie —
  // bouncing staff into an /admin redirect loop while the owner (separate
  // admin_session cookie) was unaffected.
  const parts = payload.split('|');
  const staffId = parts[0];
  const ts = parts.length >= 3 ? parts[2] : parts[1];
  if (!staffId || !ts) return null;
  if (Date.now() - Number(ts) > STAFF_COOKIE_TTL_SEC * 1000) return null;
  return staffId;
}
