// TCS adapter track() parsing — pinned to the response shapes in the COD API
// spec (.audit/tcs-cod-api-spec.txt). The critical case is the "no data"
// reply: TCS answers HTTP 200 with message:"FAIL" and null arrays until the
// first facility scan is uploaded, and that must surface as noData — not as
// an empty success that reads "already up to date" in the admin.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tcs } from './tcs';

const ENV = {
  TCS_BASE_URL: 'https://ociconnect.tcscourier.com',
  TCS_TCS_ACCOUNT: 'TEST123',
  TCS_COST_CENTER_CODE: '001',
  TCS_SHIPPER_NAME: 'Yellow Pink',
  TCS_SHIPPER_ADDRESS: 'Test Street 1',
  TCS_SHIPPER_CITY_CODE: 'LHE',
  TCS_SHIPPER_CITY_NAME: 'Lahore',
  TCS_SHIPPER_MOBILE: '03001234567',
  TCS_BEARER_TOKEN: 'test-jwt',
  TCS_USERNAME: 'user',
  TCS_PASSWORD: 'pass',
};

function mockTrackResponse(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('tcs.track', () => {
  beforeEach(() => {
    Object.assign(process.env, ENV);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const k of Object.keys(ENV)) delete process.env[k];
  });

  it('flags the "No Data Found/Invalid CN" reply as noData instead of empty success', async () => {
    mockTrackResponse({
      shipmentinfo: null,
      deliveryinfo: null,
      checkpoints: null,
      shipmentsummary: 'No Data Found/Invalid CN',
      message: 'FAIL',
      traceid: 'x',
    });
    const r = await tcs.track('173015824331');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.noData).toBe(true);
    expect(r.events).toHaveLength(0);
    expect(r.summary).toBe('No Data Found/Invalid CN');
  });

  it('parses checkpoints into normalised, newest-first events', async () => {
    mockTrackResponse({
      shipmentinfo: [{ consignmentno: '779412326902' }],
      deliveryinfo: [
        { consignmentno: '779412326902', datetime: 'Thursday Oct 17, 2024 12:58', status: 'Delivered', code: 'OK' },
      ],
      checkpoints: [
        { consignmentno: '779412326902', datetime: 'Thursday Oct 17, 2024 12:58', status: 'Shipment Delivered' },
        { consignmentno: '779412326902', datetime: 'Thursday Oct 17, 2024 09:35', status: 'Out For Delivery' },
        { consignmentno: '779412326902', datetime: 'Monday Oct 14, 2024 23:19', status: 'Arrived at TCS Facility' },
      ],
      shipmentsummary: 'Current Status: DELIVERED',
      message: 'SUCCESS',
    });
    const r = await tcs.track('779412326902');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.noData).toBeUndefined();
    expect(r.events).toHaveLength(3);
    expect(r.events[0].status).toBe('delivered');
    expect(r.current).toBe('delivered');
    expect(new Date(r.events[0].occurredAt).getTime()).toBeGreaterThan(
      new Date(r.events[2].occurredAt).getTime(),
    );
  });

  it('falls back to the shipmentsummary status when SUCCESS carries no scans', async () => {
    mockTrackResponse({
      shipmentinfo: [{ consignmentno: '173015824331' }],
      deliveryinfo: [],
      checkpoints: [],
      shipmentsummary: 'Current Status: BOOKED',
      message: 'SUCCESS',
    });
    const r = await tcs.track('173015824331');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toHaveLength(0);
    expect(r.current).toBe('created');
    expect(r.noData).toBeUndefined();
  });
});
