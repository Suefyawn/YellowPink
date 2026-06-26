import { createHmac, timingSafeEqual } from 'node:crypto';

// Resend signs webhooks with Svix. The signing secret is `whsec_<base64>` and
// the signed content is `${svix-id}.${svix-timestamp}.${rawBody}`. Shared by
// the delivery-events webhook (/api/webhooks/resend) and the inbound-email
// webhook (/api/inbound-email). Pass the RAW request body string (not parsed).
export function verifyResendSignature(secret: string, headers: Headers, body: string): boolean {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signature = headers.get('svix-signature');
  if (!id || !timestamp || !signature) return false;

  // Replay protection, reject deliveries older/newer than 5 minutes.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  const expectedBuf = Buffer.from(expected);

  // The header is a space-separated list of `v1,<sig>` entries.
  return signature.split(' ').some(part => {
    const sig = part.split(',')[1];
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}
