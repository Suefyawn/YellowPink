'use server';

import { after } from 'next/server';
import { supabase, supabaseAdmin, isDemo, getProducts } from '@/lib/supabase';
import { sendNewsletterWelcomeEmail } from '@/lib/email';
import { captureError } from '@/lib/monitoring';
import { log } from '@/lib/logger';
import { categoriesForAnswers, type Branch, type QuizAnswers } from '@/lib/quiz';

export interface QuizPick {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  image_url: string | null;
}

const MAX_PICKS = 6;

/** Map answers → categories → live products. In-stock first, most specific
 *  category first, de-duplicated, capped. */
export async function getQuizRecommendations(answers: QuizAnswers): Promise<QuizPick[]> {
  try {
    const cats = categoriesForAnswers(answers);
    if (cats.length === 0) return [];
    const all = await getProducts(); // published, visibility-filtered
    const picks: QuizPick[] = [];
    const seen = new Set<string>();
    // Pass 1: in-stock items, walking categories in priority order.
    for (const inStockOnly of [true, false]) {
      for (const cat of cats) {
        for (const p of all) {
          if (p.category !== cat || seen.has(p.id)) continue;
          const inStock = p.track_inventory === false || p.stock > 0;
          if (inStockOnly && !inStock) continue;
          seen.add(p.id);
          picks.push({ id: p.id, slug: p.slug, name: p.name, brand: p.brand, price: p.price, image_url: p.image_url ?? null });
          if (picks.length >= MAX_PICKS) return picks;
        }
      }
    }
    return picks;
  } catch (err) {
    await captureError(err, { where: 'getQuizRecommendations', branch: answers.branch });
    return [];
  }
}

async function logEvent(row: {
  session_id: string; type: 'started' | 'completed' | 'email_captured';
  branch?: Branch | null; answers?: QuizAnswers | null; recommended_ids?: string[];
}): Promise<void> {
  if (isDemo) return;
  try {
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

/** Opt-in at the results screen: subscribe to the newsletter (which sends the
 *  welcome discount email) and log the capture for the dashboard funnel. */
export async function captureQuizEmail(sessionId: string, email: string, branch: Branch): Promise<EmailResult> {
  const clean = (email ?? '').toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: 'Please enter a valid email address.' };
  try {
    await logEvent({ session_id: sessionId, type: 'email_captured', branch });
    if (isDemo) {
      after(() => sendNewsletterWelcomeEmail({ email: clean, source: 'quiz' }));
      return { ok: true };
    }
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: clean, source: 'quiz' });
    // 23505 = already subscribed → still a success, just no second welcome mail.
    if (error && error.code !== '23505') {
      log.error('quiz.newsletter_insert_failed', { error: error.message });
      return { ok: false, error: 'Something went wrong. Please try again.' };
    }
    if (!error) after(() => sendNewsletterWelcomeEmail({ email: clean, source: 'quiz' }));
    return { ok: true };
  } catch (err) {
    await captureError(err, { where: 'captureQuizEmail' });
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
