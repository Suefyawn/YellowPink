import { describe, it, expect } from 'vitest';
import {
  BRANCHES, questionsFor, classifyIntoSteps, guidesForAnswers, resultHeadline,
  HAIRCARE_STEPS, HAIR_CONCERN_RULES, HAIR_TYPE_RULES, HAIR_INSIDE_CATEGORIES,
  SKINCARE_STEPS, CONCERN_RULES, RESULT_GUIDES,
  type QuizAnswers,
} from './quiz';

// The five Hair Care products actually published at the time this branch was
// built. The classification rules are keyed on real names, so the test uses
// the real names — a synthetic "Test Shampoo" would pass while the live
// catalogue silently produced an empty routine.
const LIVE_HAIR = [
  { name: 'Saeed Ghani Hair Growth Water 120ml' },
  { name: 'Hemani Castor Oil 30ml' },
  { name: 'Conatural Rosemary Essential Oil 10ml' },
  { name: 'Minoxin Plus Minoxidil 5% 60ml' },
  { name: 'OGX Hydrate & Repair+ Argan Oil of Morocco Hair Mask 168g' },
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
    // Zero anti-dandruff products are published. Offering the option would
    // walk a shopper through the quiz to an empty result.
    const values = questionsFor('haircare')[1].options.map(o => o.value);
    expect(values).toEqual(['hairfall', 'damage', 'growth']);
    expect(values).not.toContain('dandruff');
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
    for (const c of ['hairfall', 'damage', 'growth']) {
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
