import { describe, expect, it } from 'vitest';
import { normaliseRow, parseCsv, num } from './product-csv';

const base = { brand: 'Golden Pearl', name: 'Beauty Cream', price: '306' };

describe('normaliseRow, cost_price round-trip', () => {
  // The Golden Pearl import landed 344 products with no cost price at all, so
  // Finance reported zero margin on the whole brand. Filling costs has to be a
  // spreadsheet pass, which means export → edit → re-import must carry the
  // column, and must not punish a sheet that only fills some of the rows.
  it('carries a filled cost_price through', () => {
    expect(normaliseRow({ ...base, cost_price: '145' })).toMatchObject({ cost_price: 145 });
  });

  it('accepts the human-readable "Cost price" header too', () => {
    expect(normaliseRow({ ...base, 'Cost price': '145' })).toMatchObject({ cost_price: 145 });
  });

  it('omits cost_price entirely when the cell is blank, so the upsert leaves it alone', () => {
    const row = normaliseRow({ ...base, cost_price: '' });
    expect(row).not.toBeNull();
    expect('cost_price' in row!).toBe(false);
  });

  it('omits cost_price when the column is absent altogether', () => {
    expect('cost_price' in normaliseRow(base)!).toBe(false);
  });

  it('keeps an explicit zero cost rather than treating it as blank', () => {
    expect(normaliseRow({ ...base, cost_price: '0' })).toMatchObject({ cost_price: 0 });
  });
});

describe('normaliseRow, existing behaviour still holds', () => {
  it('falls through an empty Sale price to the Regular price instead of charging 0', () => {
    const row = normaliseRow({
      brand: 'Golden Pearl', name: 'Beauty Cream',
      'Sale price': '', 'Regular price': '360',
    });
    expect(row).toMatchObject({ price: 360, original_price: null });
  });

  it('keeps the regular price as the struck-through original on a real sale', () => {
    const row = normaliseRow({
      brand: 'Golden Pearl', name: 'Beauty Cream',
      'Sale price': '306', 'Regular price': '360',
    });
    expect(row).toMatchObject({ price: 306, original_price: 360 });
  });

  it('rejects a row with no price', () => {
    expect(normaliseRow({ brand: 'Golden Pearl', name: 'Beauty Cream' })).toBeNull();
  });

  it('only honours a recognised status, ignoring anything else', () => {
    expect(normaliseRow({ ...base, status: 'published' })).toMatchObject({ status: 'published' });
    expect('status' in normaliseRow({ ...base, status: 'live' })!).toBe(false);
    expect('status' in normaliseRow({ ...base, status: '' })!).toBe(false);
  });
});

describe('parseCsv', () => {
  it('reads a BOM-prefixed CRLF export by header name', () => {
    const csv = '﻿slug,brand,name,price,cost_price\r\ngp-bc,Golden Pearl,Beauty Cream,306,145\r\n';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    // Without BOM handling the first header reads "﻿slug" and every
    // re-imported row would insert a duplicate instead of upserting.
    expect(rows[0].slug).toBe('gp-bc');
    expect(normaliseRow(rows[0])).toMatchObject({ slug: 'gp-bc', cost_price: 145 });
  });

  it('handles quoted cells containing commas and escaped quotes', () => {
    const rows = parseCsv('name,description\n"Cream, 30g","He said ""hi"""\n');
    expect(rows[0].name).toBe('Cream, 30g');
    expect(rows[0].description).toBe('He said "hi"');
  });

  it('skips fully blank lines', () => {
    expect(parseCsv('name,price\nA,1\n\nB,2\n')).toHaveLength(2);
  });
});

describe('num', () => {
  it('treats blank as absent rather than zero', () => {
    expect(num('')).toBeNull();
    expect(num('  ')).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num('', '42')).toBe(42);
    expect(num('0')).toBe(0);
  });
});
