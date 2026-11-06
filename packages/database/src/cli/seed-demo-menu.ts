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

const demoMenu = [
  {
    category: "Lanches",
    items: [
      { name: "Hambúrguer clássico", price: "32.00" },
      { name: "Sanduíche de frango", price: "28.00" },
      { name: "Batata frita", price: "18.00" },
    ],
  },
  {
    category: "Bebidas",
    items: [
      { name: "Refrigerante lata", price: "7.00" },
      { name: "Água mineral", price: "5.00" },
      { name: "Suco natural", price: "12.00" },
    ],
  },
  {
    category: "Sobremesas",
    items: [
      { name: "Pudim", price: "14.00" },
      { name: "Brownie", price: "16.00" },
    ],
  },
] as const;

async function main(): Promise<void> {
  let prisma: PrismaClient | undefined;

  try {
    requiredEnvironmentVariable("DATABASE_URL");
    if (requiredEnvironmentVariable("NODE_ENV") !== "development") {
      throw new SetupError("Os dados de demonstração só podem ser criados em NODE_ENV=development.");
    }

    prisma = new PrismaClient();
    const restaurant = await prisma.restaurant.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (!restaurant) {
      throw new SetupError("Inicialize o restaurante e o administrador antes de criar o cardápio.");
    }

    const [activeCategories, activeItems] = await Promise.all([
      prisma.menuCategory.count({
        where: { restaurantId: restaurant.id, deletedAt: null },
      }),
      prisma.menuItem.count({
        where: { restaurantId: restaurant.id, deletedAt: null },
      }),
    ]);
    if (activeCategories > 0 || activeItems > 0) {
      throw new SetupError(
        "Já existem categorias ou produtos ativos neste restaurante; nenhum dado de demonstração foi criado.",
      );
    }

    await prisma.$transaction(async (transaction) => {
      for (const group of demoMenu) {
        const category = await transaction.menuCategory.create({
          data: {
            id: createId(),
            restaurantId: restaurant.id,
            name: group.category,
          },
          select: { id: true },
        });
        for (const item of group.items) {
          await transaction.menuItem.create({
            data: {
              id: createId(),
              restaurantId: restaurant.id,
              categoryId: category.id,
              name: item.name,
              price: item.price,
              available: true,
            },
          });
        }
      }
    });

    stdout.write(
      `Cardápio de demonstração criado: ${demoMenu.length} categorias e ${demoMenu.reduce((count, group) => count + group.items.length, 0)} produtos.\n`,
    );
  } catch (error) {
    if (error instanceof SetupError) {
      stderr.write(`${error.message}\n`);
    } else {
      stderr.write("Não foi possível criar o cardápio de demonstração. Verifique a conexão e o banco.\n");
    }
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

void main();
