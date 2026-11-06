export { Prisma, PrismaClient } from "@prisma/client";
export { verifyPassword } from "./password.js";
import { PrismaClient } from "@prisma/client";

/** Create a client per application/service lifecycle; callers own disconnect. */
export function createPrismaClient(
  options?: ConstructorParameters<typeof PrismaClient>[0],
): PrismaClient {
  return new PrismaClient(options);
}
