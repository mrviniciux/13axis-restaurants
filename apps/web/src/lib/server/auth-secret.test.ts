import { describe, expect, it } from 'vitest';
import { requireAuthSecret } from './auth-secret';

describe('requireAuthSecret', () => {
  it('fails closed when the secret is missing or blank', () => {
    expect(() => requireAuthSecret(undefined)).toThrow('AUTH_SECRET');
    expect(() => requireAuthSecret('   ')).toThrow('AUTH_SECRET');
  });

  it('returns the configured secret without surrounding whitespace', () => {
    expect(requireAuthSecret('  a-real-secret  ')).toBe('a-real-secret');
  });
});
