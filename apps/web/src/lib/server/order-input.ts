import { UtcTimestampSchema, UuidV7Schema } from "@13axis/shared";
import { z } from "zod";
import { ApiProblemError, type ProblemFieldError } from "./problem";

export type CreateOrderInput = Readonly<{
  id: string;
  comandaNumber: number | null;
  tableId: string | null;
  customerId: string | null;
  customerName: string | null;
  peopleCount: number | null;
  deviceId: string | null;
  /** Accepted as client metadata for contract compatibility; never persisted. */
  createdAt?: string;
}>;

const CreateOrderSchema = z
  .object({
    id: UuidV7Schema,
    comandaNumber: z
      .number()
      .int()
      .min(1)
      .max(2_147_483_647)
      .nullable()
      .optional(),
    tableId: UuidV7Schema.nullable().optional(),
    customerId: UuidV7Schema.nullable().optional(),
    customerName: z.string().trim().max(200).nullable().optional(),
    peopleCount: z.number().int().min(1).max(999).nullable().optional(),
    deviceId: z.string().nullable().optional(),
    createdAt: UtcTimestampSchema.optional(),
  })
  .strict();

function toFieldErrors(
  issues: readonly z.core.$ZodIssue[],
): ProblemFieldError[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    code:
      issue.code === "unrecognized_keys" ? "unrecognized_field" : issue.code,
    message:
      issue.code === "unrecognized_keys"
        ? "Campo não permitido."
        : issue.path.includes("id") || issue.path.includes("tableId")
          ? "Identificador inválido."
          : issue.path.includes("createdAt")
            ? "A data deve ser um timestamp UTC válido."
            : issue.path.includes("comandaNumber")
              ? "Informe um número de comanda inteiro e positivo."
              : "Valor inválido.",
  }));
}

/**
 * Validate the create envelope with the shared UUID/timestamp Zod schemas.
 * The server owns canonical createdAt/updatedAt values.
 */
export function parseCreateOrderInput(input: unknown): CreateOrderInput {
  const parsed = CreateOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw ApiProblemError.validation(toFieldErrors(parsed.error.issues));
  }

  const data = parsed.data;
  return {
    id: data.id,
    comandaNumber: data.comandaNumber ?? null,
    tableId: data.tableId ?? null,
    customerId: data.customerId ?? null,
    customerName: data.customerName ?? null,
    peopleCount: data.peopleCount ?? null,
    deviceId: data.deviceId ?? null,
    ...(data.createdAt === undefined ? {} : { createdAt: data.createdAt }),
  };
}

export type AddOrderItemInput = Readonly<{
  id: string;
  menuItemId: string;
  quantity: string;
  notes: string | null;
}>;

const QuantitySchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,6})(?:[.,]\d{1,3})?$/)
  .refine((value) => Number(value.replace(",", ".")) > 0)
  .transform((value) => value.replace(",", "."));

const AddOrderItemSchema = z
  .object({
    id: UuidV7Schema,
    menuItemId: UuidV7Schema,
    quantity: QuantitySchema,
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

const NotesSchema = z.string().trim().max(500);

export function parseAddOrderItemInput(input: unknown): AddOrderItemInput {
  const parsed = AddOrderItemSchema.safeParse(input);
  if (!parsed.success) {
    throw ApiProblemError.validation(toFieldErrors(parsed.error.issues));
  }
  return {
    id: parsed.data.id,
    menuItemId: parsed.data.menuItemId,
    quantity: parsed.data.quantity,
    notes: parsed.data.notes || null,
  };
}

export type UpdateOrderItemInput = Readonly<{
  expectedVersion: number;
  quantity: string;
  notes: string | null;
}>;

const UpdateOrderItemSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    quantity: QuantitySchema,
    notes: NotesSchema.optional(),
  })
  .strict();

export function parseUpdateOrderItemInput(
  input: unknown,
): UpdateOrderItemInput {
  const parsed = UpdateOrderItemSchema.safeParse(input);
  if (!parsed.success) {
    throw ApiProblemError.validation(toFieldErrors(parsed.error.issues));
  }
  return {
    expectedVersion: parsed.data.expectedVersion,
    quantity: parsed.data.quantity,
    notes: parsed.data.notes || null,
  };
}

export function parseDeleteOrderItemInput(input: unknown): number {
  const parsed = z
    .object({ expectedVersion: z.number().int().positive() })
    .strict()
    .safeParse(input);
  if (!parsed.success) {
    throw ApiProblemError.validation(toFieldErrors(parsed.error.issues));
  }
  return parsed.data.expectedVersion;
}

export type UpdateOrderDetailsInput = Readonly<{
  customerId: string | null;
  customerName: string | null;
  peopleCount: number | null;
}>;

const UpdateOrderDetailsSchema = z
  .object({
    customerId: UuidV7Schema.nullable().optional(),
    customerName: z.string().trim().max(200).nullable().optional(),
    peopleCount: z.number().int().min(1).max(999).nullable().optional(),
  })
  .strict();

export function parseUpdateOrderDetailsInput(
  input: unknown,
): UpdateOrderDetailsInput {
  const parsed = UpdateOrderDetailsSchema.safeParse(input);
  if (!parsed.success) {
    throw ApiProblemError.validation(toFieldErrors(parsed.error.issues));
  }
  return {
    customerId: parsed.data.customerId ?? null,
    customerName: parsed.data.customerName ?? null,
    peopleCount: parsed.data.peopleCount ?? null,
  };
}
