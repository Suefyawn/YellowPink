import { describe, expect, it } from 'vitest';
import { isStaleServerActionError, isStaleBuildError, isDeploySkewError } from './stale-action';

describe('isStaleServerActionError', () => {
  it('matches the Next UnrecognizedActionError by name', () => {
    expect(isStaleServerActionError({ name: 'UnrecognizedActionError', message: '' })).toBe(true);
  });
  it('matches the "server action was not found" message', () => {
    expect(isStaleServerActionError(new Error('Failed to find Server Action "abc". This request might be from an older client.'))).toBe(true);
    expect(isStaleServerActionError(new Error('Server Action "x" was not found on the server'))).toBe(true);
  });
  it('ignores unrelated errors and non-objects', () => {
    expect(isStaleServerActionError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isStaleServerActionError(null)).toBe(false);
    expect(isStaleServerActionError('boom')).toBe(false);
  });
});

describe('isStaleBuildError', () => {
  it('matches webpack ChunkLoadError', () => {
    expect(isStaleBuildError({ name: 'ChunkLoadError', message: 'Loading chunk 493 failed.' })).toBe(true);
  });
  it('matches CSS chunk failures', () => {
    expect(isStaleBuildError(new Error('Loading CSS chunk 12 failed'))).toBe(true);
  });
  it('matches native dynamic-import failures', () => {
    expect(isStaleBuildError(new Error('Failed to fetch dynamically imported module: https://x/_next/static/chunks/a.js'))).toBe(true);
    expect(isStaleBuildError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isStaleBuildError(new Error('Importing a module script failed.'))).toBe(true);
  });
  it('does not match a stale Server Action or unrelated errors', () => {
    expect(isStaleBuildError({ name: 'UnrecognizedActionError', message: '' })).toBe(false);
    expect(isStaleBuildError(new Error('TypeError: x is not a function'))).toBe(false);
    expect(isStaleBuildError(undefined)).toBe(false);
  });
});

describe('isDeploySkewError', () => {
  it('is true for either deploy-skew kind, false otherwise', () => {
    expect(isDeploySkewError({ name: 'ChunkLoadError', message: '' })).toBe(true);
    expect(isDeploySkewError({ name: 'UnrecognizedActionError', message: '' })).toBe(true);
    expect(isDeploySkewError(new Error('some real bug'))).toBe(false);
  });
});
