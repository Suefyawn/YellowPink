// Renders a product's free-text `description` with real structure instead of
// dumping it into a single <p> (which collapses every newline, so the carefully
// laid-out "What's inside / bullets / Directions / Disclaimer" content imported
// from the catalogue rendered as one unreadable blob).
//
// It's intentionally forgiving, the catalogue's descriptions come from a mix
// of sources, so we infer structure from light conventions rather than require
// Markdown:
//   • / - / *  lines            → grouped into a bullet list
//   "Short Label:" on its own   → a sub-heading
//   "Disclaimer:"/"Note:" line  → a muted fine-print note
//   "Label: value" inline       → the label is bolded
//   blank line                  → paragraph break
// A plain run-on string (no newlines) simply renders as one paragraph, so this
// is always at least as good as the old behaviour.

import React from 'react';

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'list'; items: string[] };

const BULLET = /^\s*[•·▪‣◦*-]\s+/;
const HEADING = /^[A-Za-z][^.?!]{1,38}:\s*$/;        // "What's inside:", "Directions:"
const NOTE = /^(Disclaimer|Note|Warning|Caution|Important)\s*:/i;
const INLINE_LABEL = /^([A-Z][\w'’ &/-]{1,28}):\s+(.*)$/;

function parse(text: string): Block[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (list && list.length) blocks.push({ kind: 'list', items: list });
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (BULLET.test(line)) { (list ??= []).push(line.replace(BULLET, '').trim()); continue; }
    flush();
    if (NOTE.test(line)) { blocks.push({ kind: 'note', text: line }); continue; }
    if (HEADING.test(line)) { blocks.push({ kind: 'heading', text: line.replace(/:\s*$/, '') }); continue; }
    blocks.push({ kind: 'para', text: line });
  }
  flush();
  return blocks;
}

/** Bold the lead of a "Name, detail" bullet (e.g. the product name in a combo
 *  "What's inside" list) so the eye can scan the items. */
function renderItem(item: string): React.ReactNode {
  const m = item.match(/^(.{2,40}?)\s+[—–-]\s+(.*)$/);
  if (m) return (<><strong style={{ fontWeight: 600 }}>{m[1]}</strong>{', '}{m[2]}</>);
  return item;
}

/** Bold a leading "Label:" inside a paragraph (e.g. "Directions: take one…"). */
function renderPara(text: string): React.ReactNode {
  const m = text.match(INLINE_LABEL);
  if (m) return (<><strong style={{ fontWeight: 600 }}>{m[1]}:</strong>{' '}{m[2]}</>);
  return text;
}

export function ProductDescription({ text, maxWidth = 460 }: { text: string; maxWidth?: number }) {
  const blocks = parse(text);
  if (blocks.length === 0) return null;

  return (
    <div style={{ maxWidth, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <div key={i} style={{
                fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--ink-900)',
                marginTop: i === 0 ? 0 : 4,
              }}>
                {b.text}
              </div>
            );
          case 'list':
            return (
              <ul key={i} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {b.items.map((it, j) => (
                  <li key={j} style={{ position: 'relative', paddingLeft: 18, color: 'var(--ink-700)', fontSize: '0.875rem', lineHeight: 1.55 }}>
                    <span aria-hidden="true" style={{
                      position: 'absolute', left: 0, top: '0.5em',
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-yellow)',
                    }} />
                    {renderItem(it)}
                  </li>
                ))}
              </ul>
            );
          case 'note':
            return (
              <p key={i} className="small-text" style={{ color: 'var(--ink-500)', fontSize: '0.75rem', lineHeight: 1.5, margin: 0 }}>
                {renderPara(b.text)}
              </p>
            );
          default:
            return (
              <p key={i} className="body-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
                {renderPara(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
