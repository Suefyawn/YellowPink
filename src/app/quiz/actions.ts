'use server';

import { randomBytes } from 'crypto';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { supabase, supabaseAdmin, isDemo } from '@/lib/supabase';
import { sendQuizResultsEmail } from '@/lib/email';
import { captureError } from '@/lib/monitoring';
import { quizEmailLimiter, quizEventLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { log } from '@/lib/logger';
import {
  CONCERN_RULES, SKIN_TYPE_RULES, SKINCARE_STEPS, GOAL_CATEGORIES, FOCUS_RULES,
  guidesForAnswers, resultHeadline,
  type Branch, type QuizAnswers,
} from '@/lib/quiz';
import { DEMO_PRODUCTS } from '@/lib/demo-data';
import type { Product } from '@/types';

// ─── Result shapes shared with the client + share page ──────────────────────

export interface RoutinePick {
  product: Product;
  /** One line tying the pick to the shopper's answers. */
  why: string;
}

export interface RoutineSection {
  key: string;
  label: string;
  note: string;
  picks: RoutinePick[]; // best match first, optional alternate second
}

export interface RoutineResult {
  code: string;
  headline: string;
  sections: RoutineSection[];
  guides: { slug: string; title: string }[];
}

// ─── Scoring engine ──────────────────────────────────────────────────────────
// Keyword hits are weighted by where they land: product name says what the
// product IS (a niacinamide serum), the descriptions merely mention things.

interface ScoreRow {
  product: Product;
  score: number;
  hits: string[];
}

const text = (p: Product) => ({
  name: (p.name ?? '').toLowerCase(),
  short: ((p as { short_description?: string | null }).short_description ?? '').toLowerCase(),
  long: ((p as { description?: string | null }).description ?? '').toLowerCase(),
});

function scoreProduct(p: Product, keywords: string[], typeKeywords: string[]): ScoreRow {
  const t = text(p);
  let score = 0;
  const hits: string[] = [];
  for (const kw of keywords) {
    if (t.name.includes(kw)) { score += 3; hits.push(kw); }
    else if (t.short.includes(kw)) { score += 2; hits.push(kw); }
    else if (t.long.includes(kw)) { score += 1; hits.push(kw); }
  }
  for (const kw of typeKeywords) {
    if (t.name.includes(kw) || t.short.includes(kw)) score += 1;
  }
  const inStock = p.track_inventory === false || p.stock > 0;
  if (inStock) score += 2;
  if (p.is_bestseller) score += 1;
  score += (Number(p.rating ?? 0) / 5);
  return { product: p, score, hits };
}

/** Pretty ingredient names for the "why" line. */
const HIT_LABEL: Record<string, string> = {
  bha: 'BHA', spf: 'SPF', aha: 'AHA', uv: 'UV filters', coq10: 'CoQ10', q10: 'CoQ10',
  b12: 'vitamin B12', 'b-complex': 'B-complex', d3: 'vitamin D3', hydrat: 'deep hydration',
  moistur: 'lasting moisture', exfoli: 'gentle exfoliation', brighten: 'brightening actives',
  immun: 'immune support', constipat: 'gentle regularity', bloat: 'bloating relief',
  pregnan: 'pregnancy support', radian: 'radiance', balanc: 'balance', conceive: 'conception support',
};
const prettyHit = (h: string) => HIT_LABEL[h] ?? h;

function buildWhy(concernLabel: string, hits: string[]): string {
  const named = [...new Set(hits.map(prettyHit))].slice(0, 2);
  return named.length > 0
    ? `Picked for ${concernLabel}: ${named.join(' + ')}`
    : `A solid all-rounder for ${concernLabel}`;
}

async function catalogueForEngine(): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS;
  // The engine needs the descriptions (that's where ingredients live), so it
  // uses its own projection instead of PRODUCT_TILE_COLUMNS. Result objects
  // still satisfy the tile renderer (superset of its fields).
  const { data, error } = await supabase
    .from('products')
    .select('id, brand, name, variant, price, original_price, category, subcategory, tag, slug, stock, track_inventory, vendor_id, image_url, is_bestseller, is_featured, is_popular, packaging, status, created_at, rating, review_count, kind, short_description, description')
    .eq('status', 'published');
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

function skincareSections(all: Product[], answers: QuizAnswers): RoutineSection[] {
  const concern = CONCERN_RULES[answers.concern] ?? CONCERN_RULES.dullness;
  const typeKws = SKIN_TYPE_RULES[answers.skin_type] ?? [];
  const beauty = all.filter(p => p.category === 'Cleansers & Treatments' || p.category === 'Moisturizers');

  // Classify each product into exactly one step (priority order of
  // SKINCARE_STEPS: protect wins over moisturise for sun creams).
  const byStep = new Map<string, Product[]>();
  for (const p of beauty) {
    const name = (p.name ?? '').toLowerCase();
    const step = SKINCARE_STEPS.find(s => s.match.some(m => name.includes(m)));
    if (!step) continue;
    (byStep.get(step.key) ?? byStep.set(step.key, []).get(step.key)!).push(p);
  }

  const sections: RoutineSection[] = [];
  for (const step of SKINCARE_STEPS) {
    const pool = byStep.get(step.key) ?? [];
    if (pool.length === 0) continue;
    const ranked = pool
      .map(p => scoreProduct(p, concern.keywords, typeKws))
      .sort((a, b) => b.score - a.score);
    const picks: RoutinePick[] = ranked.slice(0, 2).map((r, i) => ({
      product: r.product,
      why: i === 0 ? buildWhy(concern.label, r.hits) : 'Or try this instead',
    }));
    sections.push({ key: step.key, label: step.label, note: step.note, picks });
  }

  // Routine reads cleanse → treat → moisturise → protect on screen.
  const order = ['cleanse', 'treat', 'moisturize', 'protect'];
  sections.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return sections;
}

function wellnessSections(all: Product[], answers: QuizAnswers): RoutineSection[] {
  const cats = GOAL_CATEGORIES[answers.goal] ?? [];
  const rule = FOCUS_RULES[`${answers.goal}:${answers.focus}`] ?? { label: 'your goals', keywords: [] };
  const pool = all.filter(p => cats.includes(p.category));
  if (pool.length === 0) return [];
  const ranked = pool
    .map(p => scoreProduct(p, rule.keywords, []))
    .sort((a, b) => b.score - a.score);
  const [core, ...rest] = ranked;
  const sections: RoutineSection[] = [{
    key: 'core', label: 'Start here', note: 'The pick that fits your answers most closely.',
    picks: [{ product: core.product, why: buildWhy(rule.label, core.hits) }],
  }];
  // Supporting picks must actually match the focus keywords; a no-hit
  // category-mate (a sweetener next to a fibre supplement) reads as filler.
  // Only when nothing else matches do the top category-mates stand in.
  const withHits = rest.filter(r => r.hits.length > 0).slice(0, 3);
  const supporting = (withHits.length > 0 ? withHits : rest.slice(0, 2)).map(r => ({
    product: r.product,
    why: r.hits.length > 0 ? buildWhy(rule.label, r.hits) : 'Pairs well with the pick above',
  }));
  if (supporting.length > 0) {
    sections.push({ key: 'support', label: 'Worth adding', note: 'Complementary picks from the same range.', picks: supporting });
  }
  return sections;
}

/** Build the routine, persist it under a short unguessable code, and return
 *  it. The saved row powers /quiz/r/<code> (share / email / revisit). */
export async function buildRoutine(answers: QuizAnswers): Promise<RoutineResult | null> {
  try {
    const all = await catalogueForEngine();
    const sections = answers.branch === 'skincare'
      ? skincareSections(all, answers)
      : wellnessSections(all, answers);
    if (sections.length === 0) return null;
    const guides = guidesForAnswers(answers);
    const code = randomBytes(6).toString('base64url');
    if (!isDemo) {
      const { error } = await supabaseAdmin().from('quiz_results').insert({
        code,
        branch: answers.branch,
        answers,
        sections: sections.map(s => ({
          key: s.key, label: s.label, note: s.note,
          picks: s.picks.map(p => ({ id: p.product.id, why: p.why })),
        })),
        guides,
      });
      if (error) log.warn('quiz.result_save_failed', { error: error.message });
    }
    return { code, headline: resultHeadline(answers), sections, guides };
  } catch (err) {
    await captureError(err, { where: 'buildRoutine', branch: answers.branch });
    return null;
  }
}

/** Load a saved routine for the share page. Missing products (unpublished
 *  since) are dropped; an empty result means 404. */
export async function loadRoutine(code: string): Promise<RoutineResult | null> {
  if (isDemo || !/^[A-Za-z0-9_-]{4,16}$/.test(code)) return null;
  try {
    const admin = supabaseAdmin();
    const { data: row } = await admin.from('quiz_results').select('*').eq('code', code).maybeSingle();
    if (!row) return null;
    const ids = (row.sections as Array<{ picks: Array<{ id: string }> }>).flatMap(s => s.picks.map(p => p.id));
    const { data: products } = await admin
      .from('products')
      .select('id, brand, name, variant, price, original_price, category, subcategory, tag, slug, stock, track_inventory, image_url, is_bestseller, is_featured, is_popular, packaging, status, created_at, rating, review_count, kind')
      .in('id', ids)
      .eq('status', 'published');
    const byId = new Map(((products ?? []) as unknown as Product[]).map(p => [p.id, p]));
    const sections: RoutineSection[] = (row.sections as Array<{ key: string; label: string; note: string; picks: Array<{ id: string; why: string }> }>)
      .map(s => ({
        key: s.key, label: s.label, note: s.note,
        picks: s.picks
          .map(p => byId.has(p.id) ? { product: byId.get(p.id)!, why: p.why } : null)
          .filter((p): p is RoutinePick => p !== null),
      }))
      .filter(s => s.picks.length > 0);
    if (sections.length === 0) return null;
    return {
      code: row.code,
      headline: resultHeadline(row.answers as QuizAnswers),
      sections,
      guides: (row.guides ?? []) as { slug: string; title: string }[],
    };
  } catch (err) {
    await captureError(err, { where: 'loadRoutine' });
    return null;
  }
}

// ─── Funnel analytics (unchanged) ────────────────────────────────────────────

async function logEvent(row: {
  session_id: string; type: 'started' | 'completed' | 'email_captured';
  branch?: Branch | null; answers?: QuizAnswers | null; recommended_ids?: string[];
}): Promise<void> {
  if (isDemo) return;
  try {
    const rl = await quizEventLimiter.limit(ipFromHeaders(await headers()));
    if (!rl.success) return;
    await supabaseAdmin().from('quiz_events').insert({
      session_id: row.session_id,
      type: row.type,
      branch: row.branch ?? null,
      answers: row.answers ?? null,
      recommended_ids: row.recommended_ids ?? [],
    });
  } catch (err) {
    log.warn('quiz.event_log_failed', { type: row.type, err: err instanceof Error ? err.message : String(err) });
  }
}

export async function recordQuizStart(sessionId: string): Promise<void> {
  await logEvent({ session_id: sessionId, type: 'started' });
}

export async function recordQuizComplete(
  sessionId: string, branch: Branch, answers: QuizAnswers, recommendedIds: string[],
): Promise<void> {
  await logEvent({ session_id: sessionId, type: 'completed', branch, answers, recommended_ids: recommendedIds });
}

export interface EmailResult { ok: boolean; error?: string }

/** Results-screen opt-in: emails the shopper their ACTUAL routine (picks,
 *  why-lines, saved-result link) and subscribes them to the newsletter with
 *  the welcome offer folded into the same email, so one signup sends one
 *  email, not two. */
export async function captureQuizEmail(sessionId: string, email: string, code: string): Promise<EmailResult> {
  const clean = (email ?? '').toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: 'Please enter a valid email address.' };
  const rl = await quizEmailLimiter.limit(ipFromHeaders(await headers()));
  if (!rl.success) {
    return { ok: false, error: 'Too many attempts. Please try again in a few minutes.' };
  }
  try {
    const routine = await loadRoutine(code);
    if (!routine && !isDemo) return { ok: false, error: 'This result has expired. Please retake the quiz.' };
    await logEvent({ session_id: sessionId, type: 'email_captured', branch: null });
    if (!isDemo) {
      // Subscribe (23505 = already on the list, fine either way).
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert({ email: clean, source: 'quiz' });
      if (error && error.code !== '23505') {
        log.error('quiz.newsletter_insert_failed', { error: error.message });
      }
    }
    if (routine) {
      after(() => sendQuizResultsEmail({
        email: clean,
        headline: routine.headline,
        code: routine.code,
        items: routine.sections.flatMap(s => s.picks.map(p => ({
          name: p.product.name,
          brand: p.product.brand ?? '',
          price: p.product.price,
          slug: p.product.slug,
          why: p.why,
          section: s.label,
        }))),
      }));
    }
    return { ok: true };
  } catch (err) {
    await captureError(err, { where: 'captureQuizEmail' });
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
