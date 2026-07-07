import React from 'react';

// Small uppercase eyebrow label. Defaults to a <span> (decorative), but pass
// `as="h2"`/`"h3"` where the eyebrow is actually the section's title so the
// page keeps a real heading outline for SEO/AT without changing the look.
export function Overline({
  children,
  style,
  as: Tag = 'span',
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  as?: 'span' | 'h2' | 'h3';
}) {
  return (
    <Tag className="overline" style={Tag === 'span' ? style : { margin: 0, ...style }}>{children}</Tag>
  );
}
