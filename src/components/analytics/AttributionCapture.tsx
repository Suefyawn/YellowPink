'use client';

// Records marketing attribution (UTM params on entry, first-touch landing /
// referrer) into a cookie so it's available at checkout. Renders nothing.
// Always active — attribution is campaign metadata, not analytics tracking, so
// it isn't consent-gated (no PII, no third-party request).

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { captureAttribution } from '@/lib/attribution';

function Capture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    captureAttribution();
  }, [pathname, searchParams]);
  return null;
}

export function AttributionCapture() {
  return (
    <Suspense fallback={null}>
      <Capture />
    </Suspense>
  );
}
