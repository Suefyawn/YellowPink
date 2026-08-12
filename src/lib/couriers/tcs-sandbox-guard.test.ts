import { describe, expect, it } from 'vitest';
import { isSandboxBaseUrl } from './tcs';

// A booking against TCS's UAT host returns a consignment number that exists
// nowhere in the real account: the shipment row says "booked", the order says
// Processing, and the parcel is never collected. Order YP-6WTC3EC7V lost nine
// days that way. These cases pin the host detection that now blocks it.
describe('isSandboxBaseUrl', () => {
  it('flags TCS UAT and other non-production hosts', () => {
    expect(isSandboxBaseUrl('https://devconnect.tcscourier.com')).toBe(true);
    expect(isSandboxBaseUrl('https://DEVCONNECT.tcscourier.com')).toBe(true);
    expect(isSandboxBaseUrl('https://uat.tcscourier.com')).toBe(true);
    expect(isSandboxBaseUrl('https://sandbox.example.com')).toBe(true);
    expect(isSandboxBaseUrl('https://staging.tcscourier.com')).toBe(true);
  });

  it('passes the real production host', () => {
    expect(isSandboxBaseUrl('https://ociconnect.tcscourier.com')).toBe(false);
    expect(isSandboxBaseUrl('https://ociconnect.tcscourier.com/')).toBe(false);
  });

  it('treats an unset URL as non-sandbox (isConfigured already gates that)', () => {
    expect(isSandboxBaseUrl('')).toBe(false);
    expect(isSandboxBaseUrl(undefined)).toBe(false);
  });
});
