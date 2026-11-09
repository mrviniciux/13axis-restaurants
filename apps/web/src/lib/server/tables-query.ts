import { UtcTimestampSchema } from "@13axis/shared";
import { z } from "zod";
import { ApiProblemError } from "./problem";

const TablesQuerySchema = z
  .object({ updatedSince: UtcTimestampSchema.optional() })
  .strict();

export function parseTablesQuery(url: URL): { updatedSince?: string } {
  const raw: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (Object.hasOwn(raw, key)) {
      throw ApiProblemError.validation([
        {
          path: key,
          code: "duplicate_parameter",
          message: "Parâmetro duplicado.",
        },
      ]);
    }
    raw[key] = value;
  }

  const parsed = TablesQuerySchema.safeParse(raw);
  if (!parsed.success) {
    throw ApiProblemError.validation(
      parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        code:
          issue.code === "unrecognized_keys"
            ? "unrecognized_field"
            : issue.code,
        message: issue.path.includes("updatedSince")
          ? "A data deve ser um timestamp UTC válido."
          : "Parâmetro de consulta inválido.",
      })),
    );
  }

  return parsed.data.updatedSince === undefined
    ? {}
    : { updatedSince: parsed.data.updatedSince };
}
