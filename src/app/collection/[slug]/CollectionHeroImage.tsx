'use client';

import { useState } from 'react';
import Image from 'next/image';

// Collection hero photo with a graceful failure mode: if the image 404s or
// the CDN is unreachable, hide the broken <img> (and the alt-text ghost the
// browser paints in its place) so the branded gradient underlay rendered by
// the page shows through instead of a dead band.
export function CollectionHeroImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      sizes="100vw"
      style={{ objectFit: 'cover' }}
      onError={() => setFailed(true)}
    />
  );
}
