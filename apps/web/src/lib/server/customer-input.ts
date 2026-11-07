import { z } from 'zod';
import { ApiProblemError, type ProblemFieldError } from './problem';

export type CreateCustomerInput = Readonly<{
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}>;

const CreateCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(30).nullable().optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

function toFieldErrors(issues: readonly z.core.$ZodIssue[]): ProblemFieldError[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    code: issue.code === 'unrecognized_keys' ? 'unrecognized_field' : issue.code,
    message:
      issue.code === 'unrecognized_keys'
        ? 'Campo não permitido.'
        : issue.path.includes('email')
          ? 'Informe um e-mail válido.'
          : 'Informe o nome do cliente.',
  }));
}

export function parseCreateCustomerInput(input: unknown): CreateCustomerInput {
  const parsed = CreateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    throw ApiProblemError.validation(toFieldErrors(parsed.error.issues));
  }
  return {
    name: parsed.data.name,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    notes: parsed.data.notes ?? null,
  };
}
