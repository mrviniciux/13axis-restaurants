export type ProblemFieldError = {
  path: string;
  code: string;
  message: string;
};

export class ApiProblemError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    message: string,
    readonly errors?: readonly ProblemFieldError[],
  ) {
    super(message);
    this.name = "ApiProblemError";
  }

  static validation(errors: readonly ProblemFieldError[]): ApiProblemError {
    return new ApiProblemError(
      422,
      "VALIDATION_FAILED",
      "Dados inválidos",
      "Um ou mais campos não atendem ao contrato.",
      errors,
    );
  }
}

type ProblemDocument = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  requestId: string;
  errors?: readonly ProblemFieldError[];
};

/**
 * Produces RFC 9457 responses without exposing exception messages, SQL,
 * credentials, session contents, or resource data.
 */
export function problemResponse(error: unknown, instance = "/"): Response {
  const known = error instanceof ApiProblemError ? error : undefined;
  const status = known?.status ?? 500;
  const code = known?.code ?? "INTERNAL_ERROR";
  const safeInstance =
    instance.startsWith("/") && !instance.startsWith("//")
      ? instance.split("?")[0] || "/"
      : "/";

  const document: ProblemDocument = {
    type: `urn:13axis:problem:${code.toLowerCase()}`,
    title: known?.title ?? "Erro interno",
    status,
    detail: known?.message ?? "Não foi possível concluir a solicitação.",
    instance: safeInstance,
    code,
    requestId: crypto.randomUUID(),
  };

  if (known?.errors) {
    document.errors = known.errors;
  }

  return new Response(JSON.stringify(document), {
    status,
    headers: {
      "content-type": "application/problem+json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
