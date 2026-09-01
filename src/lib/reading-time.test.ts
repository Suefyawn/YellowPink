import { describe, it, expect } from 'vitest';
import { deriveReadTime } from './reading-time';

describe('deriveReadTime', () => {
  it('floors at 1 minute for short bodies', () => {
    expect(deriveReadTime('<p>Just a few words.</p>')).toBe('1 min read');
  });
  it('counts words through HTML tags and entities', () => {
    const body = `<h2>Title</h2>${'<p>' + 'word '.repeat(1000) + '</p>'}`;
    expect(deriveReadTime(body)).toBe('5 min read');
  });
  it('handles null/empty', () => {
    expect(deriveReadTime(null)).toBe('1 min read');
    expect(deriveReadTime('')).toBe('1 min read');
  });
});
