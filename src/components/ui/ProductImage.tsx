'use client';

import { useState } from 'react';
import Image from 'next/image';
import { monogramGradient, monogramInitials } from '@/lib/monogram';

interface Props {
  src?: string | null;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  /** Override the default 600w sizes hint (tile size). */
  sizes?: string;
  /** Set true for above-the-fold images to pre-load. */
  priority?: boolean;
  /** Optional label (brand / initial) used in the gradient placeholder. */
  label?: string | null;
  /** Fixed-size mode: when both are set, render `<Image width height>`
   *  instead of `<Image fill>`. Use for thumbnails so Next's image
   *  optimizer only generates srcSet candidates near the requested size
   *  (the default `fill` mode emits all deviceSizes up to 1920w, which
   *  is wasted bandwidth for an 80px-wide thumb). */
  width?: number;
  height?: number;
  /** How the image fills its box. Defaults to 'cover' (tiles/thumbnails); use
   *  'contain' for the PDP hero so a portrait bottle shows whole rather than
   *  being cropped ("zoomed in"). */
  fit?: 'cover' | 'contain';
}

const DEFAULT_SIZES = '(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 320px';

export function ProductImage({ src, alt, style, className, sizes = DEFAULT_SIZES, priority = false, label, width, height, fit = 'cover' }: Props) {
  const [errored, setErrored] = useState(false);
  // Fade the image in once it decodes so it doesn't "pop" in on top of the
  // placeholder background, a small touch that makes the grid feel calmer.
  const [loaded, setLoaded] = useState(false);
  const fade: React.CSSProperties = { opacity: loaded ? 1 : 0, transition: 'opacity 300ms ease-out' };

  if (src && !errored) {
    // Fixed-size mode for thumbnails, Next emits a tight srcSet around
    // the requested dimensions instead of the full deviceSizes ladder.
    if (width && height) {
      return (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          style={{ objectFit: fit, width: '100%', height: '100%', ...fade, ...style }}
          className={className}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          unoptimized={src.startsWith('data:')}
        />
      );
    }
    return (
      <span style={{ position: 'relative', display: 'block', width: '100%', height: '100%', ...style }} className={className}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectFit: fit, ...fade }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          unoptimized={src.startsWith('data:')}
        />
      </span>
    );
  }

  // Gradient placeholder. `label` (brand / product name) drives the colour
  // hash + initials so different products in the same view look distinct.
  const placeholderLabel = label ?? alt ?? '';
  return (
    <div
      className={`${className ?? ''}`}
      role="presentation"
      style={{
        width: '100%', height: '100%',
        background: monogramGradient(placeholderLabel || 'YP'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(17,24,39,0.45)',
        fontFamily: 'var(--font-display, Georgia, serif)',
        fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
        fontWeight: 500,
        letterSpacing: '0.05em',
        userSelect: 'none',
        ...style,
      }}
    >
      {monogramInitials(placeholderLabel || 'YP')}
    </div>
  );
}
