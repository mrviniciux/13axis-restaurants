import { createId } from "@mudra/shared";
import { PrismaClient } from "@prisma/client";
import { stderr, stdout } from "node:process";

class SetupError extends Error {}

function requiredEnvironmentVariable(name: "DATABASE_URL" | "NODE_ENV"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SetupError(`Defina ${name} antes de executar esta tarefa.`);
  }
  return value;
}

async function main(): Promise<void> {
  let prisma: PrismaClient | undefined;

  try {
    requiredEnvironmentVariable("DATABASE_URL");
    if (requiredEnvironmentVariable("NODE_ENV") !== "development") {
      throw new SetupError("Os dados de demonstração só podem ser criados em NODE_ENV=development.");
    }

    const database = new PrismaClient();
    prisma = database;
    const restaurant = await database.restaurant.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (!restaurant) {
      throw new SetupError("Inicialize o restaurante e o administrador antes de criar mesas.");
    }

    const existingTables = await database.table.count({
      where: { restaurantId: restaurant.id, deletedAt: null },
    });
    if (existingTables > 0) {
      throw new SetupError(
        "Já existem mesas ativas neste restaurante; nenhuma mesa de demonstração foi criada.",
      );
    }

    const capacities = [2, 2, 4, 4, 4, 4, 6, 6, 2, 2, 4, 4] as const;
    await database.$transaction(
      capacities.map((capacity, index) =>
        database.table.create({
          data: {
            id: createId(),
            restaurantId: restaurant.id,
            number: index + 1,
            capacity,
          },
        }),
      ),
    );

    stdout.write(`Criadas ${capacities.length} mesas de demonstração no restaurante ${restaurant.id}.\n`);
  } catch (error) {
    if (error instanceof SetupError) {
      stderr.write(`${error.message}\n`);
    } else {
      stderr.write("Não foi possível criar as mesas de demonstração. Verifique a conexão e o banco.\n");
    }
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

void main();
