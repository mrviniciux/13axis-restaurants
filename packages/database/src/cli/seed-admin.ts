import * as argon2 from "argon2";
import { createId } from "@13axis/shared";
import { PrismaClient, type Prisma } from "@prisma/client";
import { stderr, stdout } from "node:process";

class SetupError extends Error {}

// Mesmo namespace do create-admin.ts para serializar bootstraps concorrentes.
const BOOTSTRAP_LOCK_NAMESPACE = 1297439826;

// Pré-cadastro não interativo e idempotente para bancos novos (Vercel, CI),
// onde o create-admin interativo não tem TTY. Em banco vazio cria restaurante
// e administrador; em banco existente reaproveita e apenas garante os campos
// abaixo. A senha clara fica somente neste arquivo de demonstração — revisar
// antes de expor o ambiente em produção.
const SEED = {
  restaurantName: "13axis Alimentos",
  cnpj: "44.444.444/4444-44",
  address: "RUA TESTE 01",
  adminEmail: "httpmarks@gmail.com",
  adminName: "13axis Alimentos",
  adminPassword: "1234",
} as const;

function requiredEnvironmentVariable(name: "DATABASE_URL"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SetupError(`Defina ${name} antes de executar esta tarefa.`);
  }
  return value;
}

type RestaurantSeedRow = {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
};

/**
 * Um restaurante por banco (mesmo modelo do create-admin): reaproveita o
 * chamado "13axis Alimentos", senão o restaurante ativo existente, senão cria.
 */
async function resolveRestaurant(
  transaction: Prisma.TransactionClient,
): Promise<{ restaurant: RestaurantSeedRow; created: boolean }> {
  const selection = {
    id: true,
    name: true,
    cnpj: true,
    address: true,
  } as const;
  const byName = await transaction.restaurant.findFirst({
    where: { name: SEED.restaurantName, deletedAt: null },
    select: selection,
  });
  if (byName) return { restaurant: byName, created: false };

  const existing = await transaction.restaurant.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: selection,
  });
  if (existing) return { restaurant: existing, created: false };

  const created = await transaction.restaurant.create({
    data: {
      id: createId(),
      name: SEED.restaurantName,
      cnpj: SEED.cnpj,
      address: SEED.address,
    },
    select: selection,
  });
  return { restaurant: created, created: true };
}

type SeedOutcome = {
  restaurantId: string;
  restaurantCreated: boolean;
  restaurantCompanyUpdated: boolean;
  adminId: string;
  adminCreated: boolean;
  adminPasswordEnsured: boolean;
  adminRoleEnsured: boolean;
};

async function applySeed(prisma: PrismaClient): Promise<SeedOutcome> {
  return prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    // Serializa tentativas concorrentes de bootstrap, incluindo processos
    // simultâneos do create-admin.
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_NAMESPACE}::integer, 1::integer) IS NOT NULL AS "locked"
    `;

    const { restaurant, created: restaurantCreated } =
      await resolveRestaurant(transaction);

    // Preenche CNPJ/endereço quando o restaurante alvo é o seed e estão vazios.
    let restaurantCompanyUpdated = false;
    if (!restaurantCreated && restaurant.name === SEED.restaurantName) {
      const data: { cnpj?: string; address?: string } = {};
      if (!restaurant.cnpj) data.cnpj = SEED.cnpj;
      if (!restaurant.address) data.address = SEED.address;
      if (data.cnpj !== undefined || data.address !== undefined) {
        await transaction.restaurant.update({
          where: { id: restaurant.id },
          data,
        });
        restaurantCompanyUpdated = true;
      }
    }

    const existingAdmin = await transaction.user.findFirst({
      where: { email: { equals: SEED.adminEmail, mode: "insensitive" } },
      select: { id: true, role: true, passwordHash: true },
    });

    let adminCreated = false;
    let adminPasswordEnsured = false;
    let adminRoleEnsured = false;
    let adminId: string;

    if (!existingAdmin) {
      // argon2 cria salt aleatório e guarda o hash Argon2id encoded; a senha
      // clara nunca é persistida nem registrada em logs.
      const passwordHash = await argon2.hash(SEED.adminPassword, {
        type: argon2.argon2id,
      });
      const admin = await transaction.user.create({
        data: {
          id: createId(),
          restaurantId: restaurant.id,
          name: SEED.adminName,
          email: SEED.adminEmail,
          passwordHash,
          role: "ADMIN",
        },
        select: { id: true },
      });
      adminId = admin.id;
      adminCreated = true;
    } else {
      adminId = existingAdmin.id;
      const passwordMatches = await argon2
        .verify(existingAdmin.passwordHash, SEED.adminPassword)
        .catch(() => false);
      if (!passwordMatches) {
        const passwordHash = await argon2.hash(SEED.adminPassword, {
          type: argon2.argon2id,
        });
        await transaction.user.update({
          where: { id: existingAdmin.id },
          data: { passwordHash },
        });
        adminPasswordEnsured = true;
      }
      if (existingAdmin.role !== "ADMIN") {
        await transaction.user.update({
          where: { id: existingAdmin.id },
          data: { role: "ADMIN" },
        });
        adminRoleEnsured = true;
      }
    }

    return {
      restaurantId: restaurant.id,
      restaurantCreated,
      restaurantCompanyUpdated,
      adminId,
      adminCreated,
      adminPasswordEnsured,
      adminRoleEnsured,
    };
  });
}

async function main(): Promise<void> {
  let prisma: PrismaClient | undefined;

  try {
    requiredEnvironmentVariable("DATABASE_URL");
    prisma = new PrismaClient();
    const outcome = await applySeed(prisma);

    if (outcome.restaurantCreated) {
      stdout.write(
        `Restaurante criado: ${outcome.restaurantId} (${SEED.restaurantName}).\n`,
      );
    } else {
      stdout.write(`Restaurante reaproveitado: ${outcome.restaurantId}.\n`);
    }
    if (outcome.restaurantCompanyUpdated) {
      stdout.write("CNPJ e endereço preenchidos no restaurante.\n");
    }

    if (outcome.adminCreated) {
      stdout.write(
        `Administrador criado: ${SEED.adminEmail} (${outcome.adminId}; restaurante ${outcome.restaurantId}).\n`,
      );
    } else if (outcome.adminPasswordEnsured) {
      stdout.write("Senha do administrador redefinida para o valor do seed.\n");
    } else {
      stdout.write(
        "Senha do administrador já correspondia ao valor do seed.\n",
      );
    }
    if (outcome.adminRoleEnsured) {
      stdout.write("Cargo do administrador garantido como ADMIN.\n");
    }
  } catch (error) {
    if (error instanceof SetupError) {
      stderr.write(`${error.message}\n`);
    } else {
      // Não imprimir Prisma errors, connection strings ou hashes.
      stderr.write(
        "Não foi possível pré-cadastrar os dados. Verifique a conexão e o banco.\n",
      );
    }
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

void main();
