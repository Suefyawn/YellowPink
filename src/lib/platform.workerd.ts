/** Cloudflare Workers version of platform.ts; selected by the alias in vite.config.ts. */
import { env } from 'cloudflare:workers';
import type { Bindings } from './platform';

export type { Bindings, ImagesBinding } from './platform';

export const isWorkers = true;

export function bindings(): Bindings {
  return env as Bindings;
}

export async function publicFile(relPath: string): Promise<ArrayBuffer> {
  const assets = (env as Bindings).ASSETS;
  if (!assets) throw new Error('ASSETS binding missing');
  const res = await assets.fetch(new Request(`https://assets.local/${relPath}`));
  if (!res.ok) throw new Error(`${relPath}: ${res.status}`);
  return res.arrayBuffer();
}

/** @sentry/cloudflare is initialised per request by withSentry in src/worker.ts. */
export async function initServerMonitoring(): Promise<void> {}
