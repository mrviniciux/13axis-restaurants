import { z } from 'zod';
import { ApiProblemError, type ProblemFieldError } from './problem';

export type CreateBuffetItemInput = Readonly<{
  name: string;
  description: string | null;
}>;

const CreateBuffetItemSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

function toFieldErrors(issues: readonly z.core.$ZodIssue[]): ProblemFieldError[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    code: issue.code === 'unrecognized_keys' ? 'unrecognized_field' : issue.code,
    message:
      issue.code === 'unrecognized_keys'
        ? 'Campo não permitido.'
        : 'Informe o nome do produto de buffet.',
  }));
}

export function parseCreateBuffetItemInput(input: unknown): CreateBuffetItemInput {
  const parsed = CreateBuffetItemSchema.safeParse(input);
  if (!parsed.success) {
    throw ApiProblemError.validation(toFieldErrors(parsed.error.issues));
  }
  return {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  };
}
