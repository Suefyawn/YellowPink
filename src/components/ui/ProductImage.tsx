'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
  src?: string | null;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  /** Override the default 600w sizes hint (tile size). */
  sizes?: string;
  /** Set true for above-the-fold images to pre-load. */
  priority?: boolean;
}

const DEFAULT_SIZES = '(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 320px';

export function ProductImage({ src, alt, style, className, sizes = DEFAULT_SIZES, priority = false }: Props) {
  const [errored, setErrored] = useState(false);

  if (src && !errored) {
    return (
      <span style={{ position: 'relative', display: 'block', width: '100%', height: '100%', ...style }} className={className}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectFit: 'cover' }}
          onError={() => setErrored(true)}
          unoptimized={src.startsWith('data:')}
        />
      </span>
    );
  }

  return (
    <div
      className={`img-placeholder${className ? ` ${className}` : ''}`}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
}
