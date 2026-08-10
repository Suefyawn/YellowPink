import { describe, expect, it } from 'vitest';
import { normalizeEmail, normalizePkPhone } from './cod-flags';

// The TS normalizer must stay in lock-step with SQL normalize_pk_phone
// (supabase/migrations/20260810_960_cod_flags.sql) — both sides of the flag
// lookup normalize independently.
describe('normalizePkPhone', () => {
  it('collapses every common Pakistani formatting to 03xxxxxxxxx', () => {
    expect(normalizePkPhone('0300 1234567')).toBe('03001234567');
    expect(normalizePkPhone('+92 300 1234567')).toBe('03001234567');
    expect(normalizePkPhone('92-300-1234567')).toBe('03001234567');
    expect(normalizePkPhone('00923001234567')).toBe('03001234567');
    expect(normalizePkPhone('3001234567')).toBe('03001234567');
    expect(normalizePkPhone('(0300) 123-4567')).toBe('03001234567');
  });

  it('passes through what it cannot interpret, empty stays empty', () => {
    expect(normalizePkPhone('12345')).toBe('12345');
    expect(normalizePkPhone('')).toBe('');
    expect(normalizePkPhone(null)).toBe('');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Ayesha@Gmail.COM ')).toBe('ayesha@gmail.com');
    expect(normalizeEmail(null)).toBe('');
  });
});
