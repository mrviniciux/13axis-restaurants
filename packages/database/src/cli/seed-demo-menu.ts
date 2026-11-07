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

interface DemoMenuItem {
  name: string;
  price: string;
  description?: string;
}

interface DemoMenuGroup {
  category: string;
  items: readonly DemoMenuItem[];
}

const demoMenu: readonly DemoMenuGroup[] = [
  {
    category: "Buffet",
    items: [
      { name: "Buffet Livre", price: "64.90" },
      { name: "Buffet por KG", price: "94.90", description: "Preço por quilograma" },
    ],
  },
  {
    category: "Refrigerantes",
    items: [
      { name: "Coca Cola 300ml", price: "6.00" },
      { name: "Coca Cola Zero 300ml", price: "6.00" },
    ],
  },
  {
    category: "Sucos",
    items: [
      { name: "Suco de Laranja", price: "13.00" },
      { name: "Suco Especial", price: "15.00" },
      { name: "Jarra de Suco Especial", price: "28.00" },
      { name: "Jarra de Laranja", price: "24.00" },
    ],
  },
  {
    category: "Cervejas",
    items: [
      { name: "Cerveja IPA Única", price: "18.00" },
      { name: "Corona", price: "16.00" },
      { name: "Tradicional", price: "12.00" },
      { name: "Duo", price: "14.00" },
      { name: "Brulé", price: "15.00" },
    ],
  },
];

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
              description: item.description ?? null,
              available: true,
            },
          });
        }
      }
    });

    const totalItems = demoMenu.reduce((count, group) => count + group.items.length, 0);
    stdout.write(
      `Cardápio de demonstração criado: ${demoMenu.length} categorias e ${totalItems} produtos.\n`,
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
