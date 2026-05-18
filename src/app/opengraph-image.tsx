import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo';

// Root-level Open Graph image. Picked up automatically as <meta property="og:image">
// for every route that does NOT supply its own image (PDP, blog posts can still
// override via their metadata.openGraph.images). Generated at build time and
// cached — no per-request cost.
//
// 1200x630 is the canonical OG dimension (also satisfies Twitter `summary_large_image`).

export const runtime = 'nodejs';
export const alt = `${SITE_NAME} — Imported beauty & wellness in Pakistan`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = '#FAF6EE';
const INK = '#0A0A0A';
const YELLOW = '#F7C948';
const PINK = '#E8487F';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: PAPER,
          // Subtle brand colour wash in the corners — same vibe as the hero
          // gradient fallback so a fresh share looks unmistakably "us".
          backgroundImage: `
            radial-gradient(at 88% 12%, ${YELLOW}55, transparent 50%),
            radial-gradient(at 10% 92%, ${PINK}44, transparent 55%)
          `,
          color: INK,
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Wordmark top-left — large enough to read on a mobile preview */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          <span style={{ color: YELLOW }}>Yellow</span>
          <span style={{ color: PINK }}>Pink</span>
        </div>

        {/* Headline — main grab. Display serif feel via heavy weight + tight
            tracking; ImageResponse doesn't ship a serif by default so we use
            an "italic-ish" decorative emphasis via colour, not font family. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            maxWidth: 880,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 86,
              fontWeight: 700,
              letterSpacing: '-0.035em',
              lineHeight: 1.02,
            }}
          >
            <div style={{ display: 'flex' }}>
              <span>Imported beauty</span>
              <span style={{ color: PINK }}>.</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span>Real results</span>
              <span style={{ color: YELLOW }}>.</span>
            </div>
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#2A2A2A',
              lineHeight: 1.35,
              maxWidth: 760,
            }}
          >
            Skincare, makeup & wellness — delivered across Pakistan with cash on delivery.
          </div>
        </div>

        {/* Bottom strip: URL + accent bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#2A2A2A',
            }}
          >
            yellowpink.pk
          </div>
          <div
            style={{
              display: 'flex',
              gap: 0,
              height: 12,
              width: 220,
              overflow: 'hidden',
              borderRadius: 3,
            }}
          >
            <div style={{ flex: 1, background: YELLOW }} />
            <div style={{ flex: 1, background: PINK }} />
            <div style={{ flex: 1, background: INK }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
