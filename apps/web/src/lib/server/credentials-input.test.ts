import { describe, expect, it } from 'vitest';
import { parseLoginCredentials } from './credentials-input';

describe('parseLoginCredentials', () => {
  it('normalizes email without changing password bytes', () => {
    expect(parseLoginCredentials({ email: '  WAITER@EXAMPLE.COM ', password: ' pass ' })).toEqual({
      email: 'waiter@example.com',
      password: ' pass ',
    });
  });

  it('rejects missing, invalid, or empty credentials', () => {
    expect(parseLoginCredentials(null)).toBeNull();
    expect(parseLoginCredentials({ email: 'not-an-email', password: 'pw' })).toBeNull();
    expect(parseLoginCredentials({ email: 'user@example.com', password: '' })).toBeNull();
  });
});
