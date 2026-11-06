type OperationalDataSurface = 'dashboard' | 'tables-module' | 'menu-catalog';

export function logOperationalDataLoadFailure(
  surface: OperationalDataSurface,
  error: unknown,
): void {
  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;

  console.error('Operational data load failed.', {
    surface,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    ...(errorCode ? { errorCode } : {}),
  });
}
