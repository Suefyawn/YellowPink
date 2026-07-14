'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';

// Product Q&A moderation follows the Reviews moderation grammar: staff with
// the `reviews` permission (the customer-content moderation duty) answer a
// pending question and publish it, or reject it. All writes run with the
// service role (RLS on product_questions has no public write path beyond the
// pending insert) and are audit-logged.

async function assertQuestions() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('reviews'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

function bounceQuestions(error: string): never {
  redirect(`/admin/questions?error=${encodeURIComponent(error)}`);
}

/** Refresh the PDP that shows this question so a newly published (or pulled)
 *  Q&A appears without waiting out the ISR window. */
async function revalidateQuestionPdp(id: string): Promise<void> {
  const { data: row } = await supabaseAdmin()
    .from('product_questions')
    .select('products(slug)')
    .eq('id', id)
    .maybeSingle();
  const prod = (row as { products?: { slug?: string } | { slug?: string }[] | null } | null)?.products;
  const slug = Array.isArray(prod) ? prod[0]?.slug : prod?.slug;
  if (slug) revalidatePath(`/product/${slug}`);
}

/** Answer + publish in one step. Approval REQUIRES a non-empty answer: a
 *  published Q&A must never be a question hanging without a reply. */
export async function answerQuestion(formData: FormData): Promise<void> {
  const session = await assertQuestions();
  const id = formData.get('id') as string;
  const answer = ((formData.get('answer') as string) ?? '').trim().slice(0, 4000);
  if (!answer) {
    bounceQuestions('Write an answer before approving — approved questions publish with their answer.');
  }

  const { error } = await supabaseAdmin()
    .from('product_questions')
    .update({ answer, status: 'approved', answered_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    log.error('question.approve_failed', { id, error: error.message });
    bounceQuestions('Could not approve the question: ' + error.message);
  }

  void logAudit(session, {
    action: 'question.approve',
    entity: 'product_questions', entity_id: id,
    diff: { chars: answer.length },
  });
  await revalidateQuestionPdp(id);
  revalidatePath('/admin/questions');
}

export async function rejectQuestion(formData: FormData): Promise<void> {
  const session = await assertQuestions();
  const id = formData.get('id') as string;
  // Also handles pulling an already-published Q&A off the PDP.
  const { error } = await supabaseAdmin()
    .from('product_questions')
    .update({ status: 'rejected' })
    .eq('id', id);
  if (error) {
    bounceQuestions('Could not reject the question: ' + error.message);
  }

  void logAudit(session, { action: 'question.reject', entity: 'product_questions', entity_id: id });
  await revalidateQuestionPdp(id);
  revalidatePath('/admin/questions');
}
