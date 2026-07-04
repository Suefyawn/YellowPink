'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

// Controlled, URL-synced search field for admin list toolbars. The previous
// pattern (`key={q}` + `defaultValue={q}`) remounted the input every time the
// debounced router.push landed, which destroyed focus and silently swallowed
// anything typed after a >=300ms pause. Local state keeps the field stable
// while typing; the URL value is copied back in only when the field is NOT
// focused, so back/forward navigation and "Clear" buttons still refresh the
// visible text without fighting the user mid-keystroke.
export function SearchInput({
  urlValue,
  onSearch,
  ...rest
}: {
  urlValue: string;
  onSearch: (v: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'>) {
  const [text, setText] = useState(urlValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferred per the set-state-in-effect rule; focus check must run on the
    // client anyway.
    queueMicrotask(() => {
      if (!cancelled && document.activeElement !== ref.current) setText(urlValue);
    });
    return () => { cancelled = true; };
  }, [urlValue]);

  return (
    <input
      ref={ref}
      value={text}
      onChange={e => { setText(e.target.value); onSearch(e.target.value); }}
      {...rest}
    />
  );
}
