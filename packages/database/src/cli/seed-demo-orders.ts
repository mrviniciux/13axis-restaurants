import { createId } from "@13axis/shared";
import { Prisma, PrismaClient } from "@prisma/client";
import { stderr, stdout } from "node:process";

const DEMO_ORDER_NUMBERS = Array.from({ length: 10 }, (_, index) => index + 20);
const DEMO_ORDER_LOCK_NAMESPACE = 1297439826;

class SetupError extends Error {}

function requiredEnvironmentVariable(
  name: "DATABASE_URL" | "NODE_ENV",
): string {
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

/** Preset items to seed into demo orders. Each entry references a menu item by name. */
interface DemoOrderPreset {
  comandaNumber: number;
  items: { menuItemName: string; quantity: string; notes?: string }[];
}

const demoOrderPresets: readonly DemoOrderPreset[] = [
  {
    comandaNumber: 20,
    items: [
      { menuItemName: "Buffet Livre", quantity: "2" },
      { menuItemName: "Coca Cola 300ml", quantity: "2" },
    ],
  },
  {
    comandaNumber: 21,
    items: [
      { menuItemName: "Buffet por KG", quantity: "1", notes: "0,850 kg" },
      { menuItemName: "Suco de Laranja", quantity: "1" },
    ],
  },
  {
    comandaNumber: 22,
    items: [
      { menuItemName: "Buffet Livre", quantity: "1" },
      { menuItemName: "Cerveja IPA Única", quantity: "2" },
    ],
  },
  {
    comandaNumber: 23,
    items: [
      { menuItemName: "Buffet Livre", quantity: "3" },
      { menuItemName: "Jarra de Suco Especial", quantity: "1" },
      { menuItemName: "Coca Cola Zero 300ml", quantity: "1" },
    ],
  },
  {
    comandaNumber: 24,
    items: [
      { menuItemName: "Corona", quantity: "3" },
      { menuItemName: "Tradicional", quantity: "2" },
    ],
  },
  {
    comandaNumber: 25,
    items: [
      { menuItemName: "Buffet Livre", quantity: "1" },
      { menuItemName: "Brulé", quantity: "1" },
    ],
  },
  {
    comandaNumber: 26,
    items: [],
  },
  {
    comandaNumber: 27,
    items: [],
  },
  {
    comandaNumber: 28,
    items: [
      { menuItemName: "Duo", quantity: "2" },
      { menuItemName: "Suco Especial", quantity: "1" },
    ],
  },
  {
    comandaNumber: 29,
    items: [
      { menuItemName: "Buffet por KG", quantity: "1", notes: "1,200 kg" },
      { menuItemName: "Jarra de Laranja", quantity: "1" },
    ],
  },
];

async function main(): Promise<void> {
  let prisma: PrismaClient | undefined;

  try {
    requiredEnvironmentVariable("DATABASE_URL");
    if (requiredEnvironmentVariable("NODE_ENV") !== "development") {
      throw new SetupError(
        "As comandas de demonstração só podem ser criadas em NODE_ENV=development.",
      );
    }

    prisma = new PrismaClient();
    const restaurant = await prisma.restaurant.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (!restaurant) {
      throw new SetupError(
        "Inicialize o restaurante e o administrador antes de criar comandas.",
      );
    }

    // Build a lookup of menu items by name so we can attach items to orders
    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id, deletedAt: null, available: true },
      select: { id: true, name: true, price: true },
    });
    const menuItemByName = new Map(menuItems.map((mi) => [mi.name, mi]));

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
        const preset = demoOrderPresets.find(
          (p) => p.comandaNumber === comandaNumber,
        );
        const orderItems = (preset?.items ?? []).flatMap((entry) => {
          const mi = menuItemByName.get(entry.menuItemName);
          if (!mi) return [];
          return [{ ...entry, menuItemId: mi.id, unitPrice: mi.price }];
        });

        const total = orderItems
          .reduce(
            (sum, oi) =>
              sum.add(
                new Prisma.Decimal(oi.quantity).mul(
                  new Prisma.Decimal(oi.unitPrice.toString()),
                ),
              ),
            new Prisma.Decimal(0),
          )
          .toFixed(2);

        const order = await transaction.order.create({
          data: {
            id: createId(),
            restaurantId: restaurant.id,
            comandaNumber,
            status: "OPEN",
            total,
            version: 1,
          },
          select: { id: true },
        });

        for (const oi of orderItems) {
          await transaction.orderItem.create({
            data: {
              id: createId(),
              orderId: order.id,
              menuItemId: oi.menuItemId,
              quantity: oi.quantity,
              unitPrice: oi.unitPrice,
              notes: oi.notes ?? null,
              status: null,
              version: 1,
            },
          });
        }
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
