// CLI entry point. Run via:
//   npm run wp-import                  → run all steps in order
//   npm run wp-import -- products      → run just one step
//   npm run wp-import -- validate      → just probe credentials, write nothing

import { probe } from './wp';
import { sb } from './sb';
import { CONFIG } from './config';
import { log, RunSummary } from './log';
import { run as runCategories }  from './importers/categories';
import { run as runAttributes }  from './importers/attributes';
import { run as runProducts }    from './importers/products';
import { run as runVariations }  from './importers/variations';
import { run as runCoupons }     from './importers/coupons';
import { run as runCustomers }   from './importers/customers';
import { run as runOrders }      from './importers/orders';
import { run as runReviews }     from './importers/reviews';
import { run as runBlog }        from './importers/blog';
import { run as runPages }       from './importers/pages';
import { run as runRedirects }   from './importers/redirects';

type Step = { name: string; fn: () => Promise<{ imported: number; skipped: number; errors: string[] }> };

// Order matters — categories/attributes before products, products before
// variations/orders/coupons/reviews, everything before redirects (which uses
// the import maps to build links).
const STEPS: Step[] = [
  { name: 'categories', fn: runCategories },
  { name: 'attributes', fn: runAttributes },
  { name: 'products',   fn: runProducts },
  { name: 'variations', fn: runVariations },
  { name: 'coupons',    fn: runCoupons },
  { name: 'customers',  fn: runCustomers },
  { name: 'orders',     fn: runOrders },
  { name: 'reviews',    fn: runReviews },
  { name: 'blog',       fn: runBlog },
  { name: 'pages',      fn: runPages },
  { name: 'redirects',  fn: runRedirects },
];

async function validate(): Promise<void> {
  log.step('validate');
  const r = await probe();
  if (!r.ok) {
    log.err(`WP probe failed: ${r.error}`);
    process.exit(1);
  }
  log.ok(`WP site reachable (WC ${r.wc}, WP "${r.wp}")`);

  if (CONFIG.dryRun) {
    log.ok('Supabase: skipped (dry-run)');
    return;
  }
  // Touch a known table to verify service-role key is valid.
  const { error } = await sb.from('products').select('id', { count: 'exact', head: true });
  if (error) {
    log.err(`Supabase probe failed: ${error.message}`);
    process.exit(1);
  }
  log.ok('Supabase reachable + service-role key valid');
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  await validate();
  if (arg === 'validate') return;

  const selected = arg
    ? STEPS.filter(s => s.name === arg)
    : STEPS;

  if (selected.length === 0) {
    log.err(`Unknown step: ${arg}. Known: ${STEPS.map(s => s.name).join(', ')}`);
    process.exit(1);
  }

  const summary = new RunSummary();

  // Start a run log row.
  let runId: string | null = null;
  if (!CONFIG.dryRun) {
    const { data } = await sb.from('wp_import_runs').insert({ status: 'running' }).select('id').single();
    runId = (data as { id?: string } | null)?.id ?? null;
  }

  for (const step of selected) {
    try {
      await summary.time(step.name, step.fn);
    } catch (err) {
      log.err(`step ${step.name} crashed: ${err instanceof Error ? err.message : String(err)}`);
      summary.steps.push({
        step: step.name, imported: 0, skipped: 0, durationMs: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  log.step('summary');
  log.info(`imported=${summary.totalImported()} errors=${summary.totalErrors()}`);

  if (runId) {
    await sb.from('wp_import_runs').update({
      finished_at: new Date().toISOString(),
      counts: summary.toCounts(),
      errors: summary.steps.flatMap(s => s.errors.map(e => `[${s.step}] ${e}`)).slice(0, 100),
      status: summary.totalErrors() === 0 ? 'success' : 'partial',
    }).eq('id', runId);
  }

  process.exit(summary.totalErrors() === 0 ? 0 : 1);
}

main().catch(err => {
  log.err(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
