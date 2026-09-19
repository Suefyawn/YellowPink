/**
 * The one module that differs per runtime. This is the Node version (Vercel,
 * `next dev`, vitest, scripts). `vite.config.ts` aliases `@/lib/platform` to
 * `platform.workerd.ts` for the Cloudflare Workers build, so nothing else in
 * `src/` imports `cloudflare:workers` or branches on where it runs.
 *
 * Keep the two files' exports identical.
 */
/** Cloudflare bindings, present only on Workers (see wrangler.jsonc). */
export type Bindings = {
  /** R2 bucket behind images.yellowpink.pk (media-storage.ts). */
  MEDIA?: {
    put: (key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }) => Promise<unknown>;
  };
  /** Static assets under public/ (publicFile). */
  ASSETS?: { fetch: (input: Request | string) => Promise<Response> };
  /** Cloudflare Images: upload-time resizing without sharp (image-normalize.ts). */
  IMAGES?: ImagesBinding;
};

export type ImagesBinding = {
  info(stream: ReadableStream): Promise<{ format: string; fileSize?: number; width?: number; height?: number }>;
  input(stream: ReadableStream): {
    transform(options: { width?: number; height?: number; fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'; gravity?: 'auto' | 'center' }): {
      output(options: { format: 'image/webp' | 'image/jpeg' | 'image/png' | 'image/avif'; quality?: number }): Promise<{ image(): ReadableStream; contentType(): string }>;
    };
  };
};

export const isWorkers = false;

export function bindings(): Bindings {
  return {};
}

/** A file under public/, read from disk here and from the ASSETS binding on Workers. */
export async function publicFile(relPath: string): Promise<ArrayBuffer> {
  // Dynamic imports: Next also compiles this module for its edge runtime
  // (via instrumentation.ts), which has no fs; the imports must not be static.
  const [{ readFile }, path] = await Promise.all([import('node:fs/promises'), import('node:path')]);
  const b = await readFile(path.join(process.cwd(), 'public', relPath));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

/** Server-side Sentry: the Next SDK here; on Workers src/worker.ts wraps the
 *  fetch handler with @sentry/cloudflare instead, so this is a no-op there. */
export async function initServerMonitoring(): Promise<void> {
  await import('../../sentry.server.config');
}
