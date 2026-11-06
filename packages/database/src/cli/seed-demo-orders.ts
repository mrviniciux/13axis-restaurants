import { createId } from "@mudra/shared";
import { Prisma, PrismaClient } from "@prisma/client";
import { stderr, stdout } from "node:process";

const DEMO_ORDER_NUMBERS = Array.from({ length: 10 }, (_, index) => index + 20);
const DEMO_ORDER_LOCK_NAMESPACE = 1297439826;

class SetupError extends Error {}

function requiredEnvironmentVariable(name: "DATABASE_URL" | "NODE_ENV"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SetupError(`Defina ${name} antes de executar esta tarefa.`);
  }
  return value;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function main(): Promise<void> {
  let prisma: PrismaClient | undefined;

  try {
    requiredEnvironmentVariable("DATABASE_URL");
    if (requiredEnvironmentVariable("NODE_ENV") !== "development") {
      throw new SetupError("As comandas de demonstração só podem ser criadas em NODE_ENV=development.");
    }

    prisma = new PrismaClient();
    const restaurant = await prisma.restaurant.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (!restaurant) {
      throw new SetupError("Inicialize o restaurante e o administrador antes de criar comandas.");
    }

    const createdNumbers = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          ${DEMO_ORDER_LOCK_NAMESPACE}::integer,
          10::integer
        ) IS NOT NULL AS "locked"
      `;

      const activeOrders = await transaction.order.findMany({
        where: {
          restaurantId: restaurant.id,
          status: "OPEN",
          deletedAt: null,
          comandaNumber: { in: DEMO_ORDER_NUMBERS },
        },
        select: { comandaNumber: true },
      });
      const existingNumbers = new Set(
        activeOrders.flatMap((order) =>
          order.comandaNumber === null ? [] : [order.comandaNumber],
        ),
      );
      const missingNumbers = DEMO_ORDER_NUMBERS.filter(
        (number) => !existingNumbers.has(number),
      );

      for (const comandaNumber of missingNumbers) {
        await transaction.order.create({
          data: {
            id: createId(),
            restaurantId: restaurant.id,
            comandaNumber,
            status: "OPEN",
            total: "0.00",
            version: 1,
          },
        });
      }

      return missingNumbers;
    });

    stdout.write(
      createdNumbers.length > 0
        ? `Criadas ${createdNumbers.length} comandas de demonstração (${createdNumbers.join(", ")}). As comandas já abertas foram mantidas.\n`
        : "As 10 comandas de demonstração (20 a 29) já estão abertas; nenhuma duplicata foi criada.\n",
    );
  } catch (error) {
    if (error instanceof SetupError) {
      stderr.write(`${error.message}\n`);
    } else if (isUniqueConstraintError(error)) {
      stderr.write(
        "Outra operação abriu uma das comandas de demonstração ao mesmo tempo. Execute o seed novamente; nenhuma comanda foi duplicada.\n",
      );
    } else {
      stderr.write(
        "Não foi possível abrir as comandas de demonstração. Verifique a conexão e o banco.\n",
      );
    }
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

void main();
