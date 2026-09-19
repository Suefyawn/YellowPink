// Module shapes that only exist on Workers. Declared by hand instead of pulling in
// @cloudflare/workers-types, whose globals (Request, fetch, ...) collide with the DOM
// types a Next.js app compiles against (same choice as Searchable).
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
