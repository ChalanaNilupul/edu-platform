import { describe, expect, it } from 'vitest';

import { resolveTrustProxy } from './app.setup.js';

describe('resolveTrustProxy', () => {
  it('disables proxy trust by default', () => {
    expect(resolveTrustProxy('false')).toBe(false);
  });

  it('accepts a boolean or a hop count', () => {
    expect(resolveTrustProxy('true')).toBe(true);
    expect(resolveTrustProxy('1')).toBe(1);
    expect(resolveTrustProxy('0')).toBe(0);
  });

  it('passes named or CIDR ranges through to Express', () => {
    expect(resolveTrustProxy('loopback')).toBe('loopback');
    expect(resolveTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
    expect(resolveTrustProxy('-1')).toBe('-1');
  });
});
