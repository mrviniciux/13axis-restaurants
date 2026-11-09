import "server-only";

import { createPrismaClient, type PrismaClient } from "@13axis/database";

const prismaGlobal = globalThis as typeof globalThis & {
  mudraPrisma?: PrismaClient;
};

/**
 * Reuse one Prisma client per Node.js process, including Next.js development
 * hot reloads. The app lifecycle owns the client; request handlers must not
 * disconnect it after each operation.
 */
export const prisma =
  prismaGlobal.mudraPrisma ?? (prismaGlobal.mudraPrisma = createPrismaClient());
