import { z } from 'zod';
import { ApiProblemError, type ProblemFieldError } from './problem';

export type CreateMenuItemInput = Readonly<{
  name: string;
  category: string;
  price: string;
}>;

const CreateMenuItemSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(80),
    price: z
      .string()
      .trim()
      .regex(/^(?:0|[1-9]\d{0,7})(?:[,.]\d{1,2})?$/)
      .transform((value) => value.replace(',', '.'))
      .refine((value) => Number(value) > 0),
  })
  .strict();

function toFieldErrors(issues: readonly z.core.$ZodIssue[]): ProblemFieldError[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    code: issue.code === 'unrecognized_keys' ? 'unrecognized_field' : issue.code,
    message:
      issue.code === 'unrecognized_keys'
        ? 'Campo não permitido.'
        : issue.path.includes('price')
          ? 'Informe um preço positivo com até duas casas decimais.'
          : 'Informe o nome e a categoria do produto.',
  }));
}

export function parseCreateMenuItemInput(input: unknown): CreateMenuItemInput {
  const parsed = CreateMenuItemSchema.safeParse(input);
  if (!parsed.success) {
    throw ApiProblemError.validation(toFieldErrors(parsed.error.issues));
  }
  return parsed.data;
}
