'use client';

import { useState } from 'react';

interface Props {
  src?: string | null;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
}

export function ProductImage({ src, alt, style, className }: Props) {
  const [errored, setErrored] = useState(false);

  if (src && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        onError={() => setErrored(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
        className={className}
      />
    );
  }

  return (
    <div
      className={`img-placeholder${className ? ` ${className}` : ''}`}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
}
