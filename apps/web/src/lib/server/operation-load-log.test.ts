import { afterEach, describe, expect, it, vi } from 'vitest';
import { logOperationalDataLoadFailure } from './operation-load-log';

describe('logOperationalDataLoadFailure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs safe error metadata without the error message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = Object.assign(new Error('contains a sensitive connection URL'), {
      code: 'P2022',
    });

    logOperationalDataLoadFailure('tables-module', error);

    expect(log).toHaveBeenCalledWith('Operational data load failed.', {
      surface: 'tables-module',
      errorName: 'Error',
      errorCode: 'P2022',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive connection URL');
  });
});
