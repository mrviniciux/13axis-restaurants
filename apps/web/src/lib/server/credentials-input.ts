import { z } from 'zod';

const CredentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email())
    .transform((email) => email.toLowerCase()),
  // Passwords are intentionally not trimmed or otherwise normalized.
  password: z.string().min(1),
});

export type LoginCredentials = z.infer<typeof CredentialsSchema>;

/** Return normalized credentials or null without exposing validation details. */
export function parseLoginCredentials(input: unknown): LoginCredentials | null {
  const parsed = CredentialsSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
