import { describe, it, expect } from 'vitest';
import {
  BRANCHES, questionsFor, classifyIntoSteps, guidesForAnswers, resultHeadline,
  HAIRCARE_STEPS, HAIR_CONCERN_RULES, HAIR_TYPE_RULES, HAIR_INSIDE_CATEGORIES,
  SKINCARE_STEPS, CONCERN_RULES, RESULT_GUIDES,
  type QuizAnswers,
} from './quiz';

// Every product published in the Hair Care category, by its exact catalogue
// name, read from the live shelf on 15 Sep 2026. The classification rules are
// keyed on real names, so the test uses the real names — a synthetic "Test
// Shampoo" would pass while the live catalogue silently produced an empty
// routine. Keep this list in step with the shelf when Hair Care changes: it is
// the only thing standing between a catalogue edit and a quiz that walks a
// shopper to an empty plan.
const LIVE_HAIR = [
  { name: 'Saeed Ghani Hair Growth Water 120ml' },
  { name: 'Hemani Castor Oil 30ml' },
  { name: 'Conatural Rosemary Essential Oil 10ml' },
  { name: 'Minoxin Plus Minoxidil 5% 60ml' },
  { name: 'OGX Hydrate & Repair+ Argan Oil of Morocco Hair Mask 168g' },
  // Published 15 Sep 2026, which is what re-opened the dandruff branch.
  { name: 'CeraVe Anti-Dandruff Hydrating Shampoo 355ml' },
  { name: 'CeraVe Anti-Dandruff Hydrating Conditioner 266ml' },
  { name: 'La Roche-Posay Kerium DS Anti-Dandruff Intensive Shampoo 125ml' },
  { name: 'OGX Renewing + Argan Oil of Morocco Shampoo 385ml' },
  { name: 'OGX Renewing + Argan Oil of Morocco Conditioner 385ml' },
  { name: 'OGX Thick & Full + Biotin & Collagen Shampoo 385ml' },
  { name: 'OGX Thick & Full + Biotin & Collagen Conditioner 385ml' },
  { name: 'Olaplex No.3 Hair Perfector 100ml' },
  { name: 'The Ordinary Multi-Peptide Serum for Hair Density 60ml' },
  // OGX Hydrating + Tea Tree Mint is deliberately absent: OGX discontinued it
  // and it was unpublished on 15 Sep. Putting it back here would make the
  // suite assert a shelf that no longer exists.
];

describe('haircare branch wiring', () => {
  it('is offered as a third branch', () => {
    expect(BRANCHES.map(b => b.value)).toContain('haircare');
  });

  it('asks exactly two questions, like the other branches', () => {
    const qs = questionsFor('haircare');
    expect(qs).toHaveLength(2);
    expect(qs.map(q => q.key)).toEqual(['hair_type', 'hair_concern']);
  });

  it('only offers concerns the catalogue can answer', () => {
    // The rule that governs this list: an option must lead to something
    // buyable. Dandruff was withheld on 14 Sep with zero anti-dandruff
    // products published, and restored on 15 Sep when three went live.
    const values = questionsFor('haircare')[1].options.map(o => o.value);
    expect(values).toEqual(['hairfall', 'dandruff', 'damage', 'growth']);
  });

  it('has real anti-dandruff stock behind the dandruff option', () => {
    // The guard that keeps the option honest: if these are ever unpublished,
    // this fails and the option must come out with them.
    const dandruff = LIVE_HAIR.filter(p => /dandruff|kerium/i.test(p.name));
    expect(dandruff.length).toBeGreaterThanOrEqual(3);
  });

  it('files an anti-dandruff shampoo as a SCALP treatment, not a length wash', () => {
    // classifyIntoSteps takes the FIRST matching step, and the lengths step
    // matches a bare 'shampoo'. Without 'dandruff' on the scalp step, the
    // dandruff plan would recommend nothing for the scalp — which is the
    // whole point of the branch.
    const byStep = classifyIntoSteps(LIVE_HAIR, HAIRCARE_STEPS);
    const scalp = (byStep.get('scalp') ?? []).map(p => p.name);
    expect(scalp).toContain('CeraVe Anti-Dandruff Hydrating Shampoo 355ml');
    expect(scalp).toContain('La Roche-Posay Kerium DS Anti-Dandruff Intensive Shampoo 125ml');
    // A plain shampoo is still lengths care.
    const lengths = (byStep.get('lengths') ?? []).map(p => p.name);
    expect(lengths).toContain('OGX Renewing + Argan Oil of Morocco Shampoo 385ml');
  });

  it('files the hair-density serum as a SCALP treatment, not a length serum', () => {
    // Same trap as the dandruff shampoo, one step further on. The lengths step
    // matches a bare 'hair', so "Multi-Peptide Serum for Hair Density" landed
    // next to the conditioners and masks until 'density' was added to the
    // scalp step. It is the most expensive product on the hair shelf and the
    // one a hair-fall answer should lead with, so filing it under conditioning
    // is not a cosmetic mistake.
    const byStep = classifyIntoSteps(LIVE_HAIR, HAIRCARE_STEPS);
    const scalp = (byStep.get('scalp') ?? []).map(p => p.name);
    expect(scalp).toContain('The Ordinary Multi-Peptide Serum for Hair Density 60ml');
    expect((byStep.get('lengths') ?? []).map(p => p.name))
      .not.toContain('The Ordinary Multi-Peptide Serum for Hair Density 60ml');
  });

  it('leaves no published hair product out of the routine entirely', () => {
    // classifyIntoSteps drops anything matching no step, silently. A product
    // that is published, costed and photographed but unreachable from the
    // Routine Finder is stock the quiz can never sell.
    const byStep = classifyIntoSteps(LIVE_HAIR, HAIRCARE_STEPS);
    const placed = new Set(
      HAIRCARE_STEPS.flatMap(s => (byStep.get(s.key) ?? []).map(p => p.name)),
    );
    const dropped = LIVE_HAIR.map(p => p.name).filter(n => !placed.has(n));
    expect(dropped, `unreachable from the quiz: ${dropped.join(', ')}`).toEqual([]);
  });

  it('every offered concern matches something on the live shelf', () => {
    // The invariant the option list rests on, and the one a future catalogue
    // change is most likely to break silently: an option must lead to a real
    // product, or the quiz walks a shopper to an empty plan. Checked against
    // the concern's own keywords rather than a hand-listed expectation, so
    // adding a concern without stock fails here rather than in production.
    for (const o of questionsFor('haircare')[1].options) {
      const kws = HAIR_CONCERN_RULES[o.value].keywords;
      const hits = LIVE_HAIR.filter(p => kws.some(k => p.name.toLowerCase().includes(k)));
      expect(hits.length, `concern "${o.value}" matches no published product`).toBeGreaterThan(0);
    }
  });

  it('has a scoring rule for every concern offered', () => {
    for (const o of questionsFor('haircare')[1].options) {
      expect(HAIR_CONCERN_RULES[o.value]).toBeDefined();
    }
  });

  it('has a type nudge for every hair type offered', () => {
    for (const o of questionsFor('haircare')[0].options) {
      expect(HAIR_TYPE_RULES[o.value]).toBeDefined();
    }
  });
});

describe('classifyIntoSteps', () => {
  it('fills both hair sections from the live catalogue', () => {
    const byStep = classifyIntoSteps(LIVE_HAIR, HAIRCARE_STEPS);
    expect(byStep.get('scalp')?.length).toBeGreaterThan(0);
    expect(byStep.get('lengths')?.length).toBeGreaterThan(0);
  });

  it('files rosemary oil as a SCALP treatment, not a length oil', () => {
    // Both steps could claim it ("rosemary" vs "oil"); priority order decides,
    // and getting this backwards is the difference between a hair-fall result
    // that recommends a growth treatment and one that recommends a hair mask.
    const byStep = classifyIntoSteps(LIVE_HAIR, HAIRCARE_STEPS);
    const scalp = (byStep.get('scalp') ?? []).map(p => p.name);
    expect(scalp).toContain('Conatural Rosemary Essential Oil 10ml');
    expect((byStep.get('lengths') ?? []).map(p => p.name))
      .not.toContain('Conatural Rosemary Essential Oil 10ml');
  });

  it('files minoxidil and the growth tonic as scalp treatments', () => {
    const scalp = (classifyIntoSteps(LIVE_HAIR, HAIRCARE_STEPS).get('scalp') ?? []).map(p => p.name);
    expect(scalp).toContain('Minoxin Plus Minoxidil 5% 60ml');
    expect(scalp).toContain('Saeed Ghani Hair Growth Water 120ml');
  });

  it('files the argan mask and castor oil as lengths care', () => {
    const lengths = (classifyIntoSteps(LIVE_HAIR, HAIRCARE_STEPS).get('lengths') ?? []).map(p => p.name);
    expect(lengths).toContain('OGX Hydrate & Repair+ Argan Oil of Morocco Hair Mask 168g');
    expect(lengths).toContain('Hemani Castor Oil 30ml');
  });

  it('puts every product in exactly one step, never two', () => {
    const byStep = classifyIntoSteps(LIVE_HAIR, HAIRCARE_STEPS);
    const all = [...byStep.values()].flat().map(p => p.name);
    expect(new Set(all).size).toBe(all.length);
  });

  it('drops a product no step claims rather than bucketing it arbitrarily', () => {
    const byStep = classifyIntoSteps([{ name: 'Rivaj UK Lipstick Pencil' }], HAIRCARE_STEPS);
    expect([...byStep.values()].flat()).toHaveLength(0);
  });

  it('still keeps SPF out of moisturise on the skincare steps it now shares', () => {
    // classifyIntoSteps replaced duplicated logic in both routines; this is
    // the skincare invariant that must survive the refactor.
    const byStep = classifyIntoSteps(
      [{ name: 'La Roche-Posay Anthelios UVMune 400 Invisible Fluid SPF50+' }],
      SKINCARE_STEPS,
    );
    expect(byStep.get('protect')).toHaveLength(1);
    expect(byStep.get('moisturize')).toBeUndefined();
  });

  it('tolerates a null name', () => {
    expect(() => classifyIntoSteps([{ name: null }], HAIRCARE_STEPS)).not.toThrow();
  });
});

describe('haircare results', () => {
  const answers = (c: string): QuizAnswers =>
    ({ branch: 'haircare', hair_type: 'dry', hair_concern: c }) as QuizAnswers;

  it('links real guides for every concern', () => {
    for (const c of ['hairfall', 'dandruff', 'damage', 'growth']) {
      expect(guidesForAnswers(answers(c)).length).toBeGreaterThan(0);
    }
  });

  it('namespaces hair guides so they cannot collide with a skincare concern', () => {
    // RESULT_GUIDES is one flat map shared by all three branches, and the
    // skincare branch looks up a BARE concern key. So every hair concern must
    // be stored prefixed, or a hair concern that happens to share a name with
    // a skincare one would serve the wrong guides to both.
    for (const concern of Object.keys(HAIR_CONCERN_RULES)) {
      expect(RESULT_GUIDES[`hair:${concern}`]).toBeDefined();
      expect(RESULT_GUIDES[concern]).toBeUndefined();
    }
    // And the lookup genuinely resolves through the prefix.
    expect(guidesForAnswers(answers('growth'))).toEqual(RESULT_GUIDES['hair:growth']);
  });

  it('keeps every skincare concern resolving to its own bare key', () => {
    for (const concern of Object.keys(CONCERN_RULES)) {
      const skin = { branch: 'skincare', skin_type: 'dry', concern } as unknown as QuizAnswers;
      expect(guidesForAnswers(skin)).toEqual(RESULT_GUIDES[concern]);
      expect(guidesForAnswers(skin).length).toBeGreaterThan(0);
    }
  });

  it('writes a headline naming the concern', () => {
    expect(resultHeadline(answers('hairfall'))).toBe('Your hair plan for hair fall & thinning');
  });

  it('falls back to a generic headline on an unknown concern', () => {
    expect(resultHeadline(answers('nonsense'))).toBe('Your personalised hair plan');
  });

  it('draws the "from the inside" section only from ingestible categories', () => {
    // 'collagen' also matches a body lotion and a face cream; recommending a
    // moisturiser as a hair supplement would be nonsense.
    expect(HAIR_INSIDE_CATEGORIES).not.toContain('Moisturizers');
    expect(HAIR_INSIDE_CATEGORIES).not.toContain('Cleansers & Treatments');
    expect(HAIR_INSIDE_CATEGORIES).toContain("Women's Health");
  });
});
