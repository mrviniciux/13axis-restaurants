type OperationalDataSurface = 'dashboard' | 'tables-module' | 'menu-catalog';

export function logOperationalDataLoadFailure(
  surface: OperationalDataSurface,
  error: unknown,
): void {
  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  const errorMeta =
    typeof error === 'object' && error !== null && 'meta' in error &&
    typeof error.meta === 'object' && error.meta !== null
      ? (error.meta as Record<string, unknown>)
      : undefined;
  const schemaTarget = errorMeta?.target;
  const modelName = errorMeta?.modelName;
  const column = errorMeta?.column;

  console.error('Operational data load failed.', {
    surface,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    ...(errorCode ? { errorCode } : {}),
    ...(typeof modelName === 'string' ? { modelName } : {}),
    ...(typeof column === 'string' ? { column } : {}),
    ...(typeof schemaTarget === 'string' ? { target: schemaTarget } : {}),
  });
}
