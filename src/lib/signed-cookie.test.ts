import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifyStaffTokenEdge, STAFF_COOKIE_TTL_SEC } from './signed-cookie';

// Mirror of staff-auth.ts signToken() — the Node-side minter whose tokens
// the Edge verifier must accept.
const SECRET = 'test-secret-abc';
function signToken(staffId: string, ts = Date.now()): string {
  const payload = `${staffId}|${ts}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

describe('verifyStaffTokenEdge', () => {
  it('accepts a token minted by the Node signer and returns the staff id', async () => {
    await expect(verifyStaffTokenEdge(signToken('staff-123'), SECRET)).resolves.toBe('staff-123');
  });

  it('rejects a token signed with a different secret', async () => {
    await expect(verifyStaffTokenEdge(signToken('staff-123'), 'other-secret')).resolves.toBeNull();
  });

  it('rejects garbage', async () => {
    await expect(verifyStaffTokenEdge('garbage', SECRET)).resolves.toBeNull();
    await expect(verifyStaffTokenEdge('', SECRET)).resolves.toBeNull();
  });

  it('rejects a tampered signature', async () => {
    const t = signToken('staff-123');
    await expect(verifyStaffTokenEdge(t.slice(0, -4) + 'AAAA', SECRET)).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const old = Date.now() - (STAFF_COOKIE_TTL_SEC + 10) * 1000;
    await expect(verifyStaffTokenEdge(signToken('staff-123', old), SECRET)).resolves.toBeNull();
  });

  it('rejects a payload with a swapped staff id (signature mismatch)', async () => {
    const ts = Date.now();
    const sig = createHmac('sha256', SECRET).update(`staff-123|${ts}`).digest('hex');
    const forged = Buffer.from(`staff-999|${ts}|${sig}`).toString('base64url');
    await expect(verifyStaffTokenEdge(forged, SECRET)).resolves.toBeNull();
  });
});
