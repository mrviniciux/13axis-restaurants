import { v7 } from "uuid";

/**
 * Gera UUID v7 no cliente para permitir criar registros offline antes do push.
 * O PostgreSQL/Prisma não gera IDs automaticamente: consumidores do modelo
 * devem enviar o ID criado aqui (ou por um gerador UUID v7 compatível).
 */
export function createId(): string {
  return v7();
}

export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
