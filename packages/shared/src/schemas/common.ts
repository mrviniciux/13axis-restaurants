import { z } from "zod";
import { UUID_V7_PATTERN } from "../ids.js";

export const UuidV7Schema = z.string().regex(UUID_V7_PATTERN, "Expected a UUID v7");

/** JSON transport timestamps use ISO 8601 UTC strings ending in Z. */
export const UtcTimestampSchema = z.iso.datetime({ offset: false });

export const SyncMetadataSchema = z.object({
  id: UuidV7Schema,
  createdAt: UtcTimestampSchema,
  updatedAt: UtcTimestampSchema,
  version: z.number().int().positive(),
  lastSyncedAt: UtcTimestampSchema.nullable(),
  deviceId: z.string().nullable(),
  deletedAt: UtcTimestampSchema.nullable(),
});

export type SyncMetadata = z.infer<typeof SyncMetadataSchema>;

/** PostgreSQL Decimal values are transported as strings to avoid JS float loss. */
export const MoneySchema = z.string().regex(/^\d{1,10}\.\d{2}$/, "Expected a decimal amount with two fractional digits");

/** Decimal(10,3) quantity as text; weighted products can be fractional. */
export const QuantitySchema = z
  .string()
  .regex(/^\d{1,7}(?:\.\d{1,3})?$/, "Expected a non-negative quantity with up to three decimals")
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero");
