import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifyStaffTokenEdge, STAFF_COOKIE_TTL_SEC } from './signed-cookie';

// Mirror of staff-auth.ts signToken() — the Node-side minter whose tokens
// the Edge verifier must accept. Current tokens carry the session_epoch, so
// the payload is 3 fields: `<staffId>|<epoch>|<issuedMs>`. (An earlier version
// of this helper minted a 2-field legacy payload, which meant the current
// format was never exercised — masking the field-parsing bug that bounced
// every staff member into an /admin redirect loop.)
const SECRET = 'test-secret-abc';
function signToken(staffId: string, epoch = 0, ts = Date.now()): string {
  const payload = `${staffId}|${epoch}|${ts}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

// The pre-epoch cookie format (2-field payload) still in the wild until every
// session ages out; the Edge verifier must keep accepting it.
function signLegacyToken(staffId: string, ts = Date.now()): string {
  const payload = `${staffId}|${ts}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

describe('verifyStaffTokenEdge', () => {
  it('accepts a current (epoch-bearing) token and returns the staff id', async () => {
    await expect(verifyStaffTokenEdge(signToken('staff-123'), SECRET)).resolves.toBe('staff-123');
  });

  it('accepts a fresh token whose epoch has been bumped (epoch != issued-at)', async () => {
    // Regression guard: the age check must read the issuedMs field, not the
    // epoch. A just-issued token with epoch=7 is well within the 10h TTL.
    await expect(verifyStaffTokenEdge(signToken('staff-123', 7), SECRET)).resolves.toBe('staff-123');
  });

  it('still accepts a legacy pre-epoch (2-field) token', async () => {
    await expect(verifyStaffTokenEdge(signLegacyToken('staff-123'), SECRET)).resolves.toBe('staff-123');
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

  it('rejects an expired token (age read from issuedMs, not epoch)', async () => {
    const old = Date.now() - (STAFF_COOKIE_TTL_SEC + 10) * 1000;
    await expect(verifyStaffTokenEdge(signToken('staff-123', 0, old), SECRET)).resolves.toBeNull();
  });

  it('rejects a payload with a swapped staff id (signature mismatch)', async () => {
    const ts = Date.now();
    const sig = createHmac('sha256', SECRET).update(`staff-123|0|${ts}`).digest('hex');
    const forged = Buffer.from(`staff-999|0|${ts}|${sig}`).toString('base64url');
    await expect(verifyStaffTokenEdge(forged, SECRET)).resolves.toBeNull();
  });
});
