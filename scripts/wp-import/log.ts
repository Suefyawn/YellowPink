// Tiny coloured logger + per-run summary collector.
//
// Each importer pushes results into the summary; run.ts writes them to the
// wp_import_runs row at the end.

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m',
};

export const log = {
  info:  (...a: unknown[]) => console.log(c.dim + new Date().toISOString() + c.reset, ...a),
  ok:    (...a: unknown[]) => console.log(c.green + '✓' + c.reset, ...a),
  warn:  (...a: unknown[]) => console.warn(c.yellow + '⚠' + c.reset, ...a),
  err:   (...a: unknown[]) => console.error(c.red + '✗' + c.reset, ...a),
  step:  (name: string)    => console.log(`\n${c.cyan}━━━ ${name} ${c.reset}${c.dim}━━━${c.reset}`),
};

export interface StepResult {
  step: string;
  imported: number;
  skipped: number;
  errors: string[];
  durationMs: number;
}

export class RunSummary {
  steps: StepResult[] = [];

  async time<T extends Omit<StepResult, 'durationMs' | 'step'>>(step: string, fn: () => Promise<T>): Promise<T> {
    log.step(step);
    const start = Date.now();
    const result = await fn();
    const r: StepResult = { step, durationMs: Date.now() - start, ...result };
    this.steps.push(r);
    const status = r.errors.length === 0 ? log.ok : log.warn;
    status(`${step}: imported=${r.imported} skipped=${r.skipped} errors=${r.errors.length} (${r.durationMs}ms)`);
    if (r.errors.length) for (const e of r.errors.slice(0, 5)) log.warn(`  ${e}`);
    return result;
  }

  totalErrors(): number { return this.steps.reduce((s, r) => s + r.errors.length, 0); }
  totalImported(): number { return this.steps.reduce((s, r) => s + r.imported, 0); }

  toCounts(): Record<string, { imported: number; skipped: number; errors: number; durationMs: number }> {
    return Object.fromEntries(
      this.steps.map(s => [s.step, { imported: s.imported, skipped: s.skipped, errors: s.errors.length, durationMs: s.durationMs }])
    );
  }
}
