import { describe, expect, it } from 'vitest';
import { resolveCorsOrigin } from './cors';

describe('resolveCorsOrigin', () => {
  it('maps the `*` default to a reflecting wildcard (true)', () => {
    expect(resolveCorsOrigin(['*'])).toBe(true);
    expect(resolveCorsOrigin(['*', 'http://localhost:5051'])).toBe(true);
  });

  it('passes an explicit allowlist through unchanged', () => {
    expect(resolveCorsOrigin(['http://localhost:5051'])).toEqual(['http://localhost:5051']);
    expect(resolveCorsOrigin(['https://a.com', 'https://b.com'])).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });
});
