import { describe, it, expect } from 'vitest';
import { matchCatalog, type OurProduct, type TheirProduct } from './price-parity';

const T = (title: string, handle: string, price: number): TheirProduct => ({ title, handle, price });
const O = (slug: string, name: string, price: number): OurProduct => ({ slug, name, price });

const THEIRS: TheirProduct[] = [
  T('Trimo-M Male Vitality Supplement', 'trimo-m', 2500),
  T('X-FIT Daily Support for Male Vitality', 'x-fit', 890),
  T('X-Fit + Trimo-M', 'x-fit-trimo-m', 3380),                       // their combo
  T('Calco Fit and  Vit KD', 'calco-fit-and-vit-kd', 2150),          // their combo (" and ")
  T('Calcofit + Gift', 'cacofit-gift', 1290),                        // their combo (gift)
  T('Argivital Sachet | Daily Health Supplement', 'argivital', 3500),
  T('FEMEEZ – Menstrual Wellness Blend', 'femeez', 950),
  T('Nakera', 'nakera', 0),                                          // unpriced listing
];

describe('matchCatalog', () => {
  it('flags a single priced below their list, via exact handle match', () => {
    const r = matchCatalog([O('trimo-m', 'Trimo-M Ashwagandha Tablets', 1790)], THEIRS);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]).toMatchObject({ slug: 'trimo-m', ourPrice: 1790, theirPrice: 2500 });
  });

  it('parity and above-parity are not violations', () => {
    const r = matchCatalog([
      O('femeez', 'FEMEEZ Menstrual Wellness Blend', 950),
      O('x-fit', 'X-Fit Men Vitality Tablets', 999),
    ], THEIRS);
    expect(r.compared).toBe(2);
    expect(r.violations).toHaveLength(0);
  });

  it('never compares a single against their combo listings', () => {
    // Our X-Fit at 890 must match their x-fit single (890), not the 3380 combo.
    const r = matchCatalog([O('x-fit', 'X-Fit Men Vitality Tablets', 890)], THEIRS);
    expect(r.violations).toHaveLength(0);
    expect(r.compared).toBe(1);
  });

  it('resolves known slug differences through the alias map', () => {
    const r = matchCatalog([O('argivital-sachet', 'Argivital L-Arginine Sachet', 3000)], THEIRS);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].theirHandle).toBe('argivital');
  });

  it('falls back to first-token title match when handles differ', () => {
    const r = matchCatalog([O('femeez-blend', 'FEMEEZ Menstrual Wellness Blend', 750)], THEIRS);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].theirPrice).toBe(950);
  });

  it('never compares different pack sizes (the SimZee 60ml vs 120ml false alarm)', () => {
    const theirs = [...THEIRS, T('SimZee Zinc Gluconate Syrup 120ml – Zinc Supplement for Kids', 'simzee', 350)];
    const r = matchCatalog([O('simzee-zinc-syrup-60ml', 'SimZee Zinc Syrup 60ml', 180)], theirs);
    expect(r.violations).toHaveLength(0);
    expect(r.unmatched).toEqual(['simzee-zinc-syrup-60ml']);
    // Same size still compares (and 1 l ≡ 1000 ml).
    const same = matchCatalog([O('simzee-zinc-syrup-120ml', 'SimZee Zinc Syrup 120ml', 180)], theirs);
    expect(same.violations).toHaveLength(1);
    const litre = matchCatalog(
      [O('hydra-tonic', 'Hydra Tonic 1l', 500)],
      [T('Hydra Tonic Water 1000ml', 'hydra-tonic', 900)],
    );
    expect(litre.violations).toHaveLength(1);
  });

  it('a unit only one side states is inconclusive, not a size conflict', () => {
    // Their title adds a 20mg strength; ours only says the brand. Still a match.
    const r = matchCatalog(
      [O('zincol', 'Zincol Syrup', 300)],
      [T('Zincol 20mg Syrup', 'zincol', 450)],
    );
    expect(r.violations).toHaveLength(1);
  });

  it('reports products it cannot match instead of guessing, and skips unpriced listings', () => {
    const r = matchCatalog([
      O('energy-boost', 'Energy Boost Multivitamin', 400),
      O('nakera', 'Nakera Something', 500),
    ], THEIRS);
    expect(r.compared).toBe(0);
    expect(r.unmatched).toEqual(['energy-boost', 'nakera']);
    expect(r.violations).toHaveLength(0);
  });
});
