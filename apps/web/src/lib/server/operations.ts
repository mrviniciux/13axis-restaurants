import 'server-only';

import { Prisma, type PrismaClient } from '@mudra/database';
import { z } from 'zod';
import { createId, UtcTimestampSchema, UuidV7Schema } from '@mudra/shared';
import {
  requireOperationalReadAccess,
  requirePermission,
  type AuthenticatedServerContext,
} from './access-control';
import { ApiProblemError } from './problem';
import {
  parseAddOrderItemInput,
  parseCreateOrderInput,
  parseDeleteOrderItemInput,
  parseUpdateOrderDetailsInput,
  parseUpdateOrderItemInput,
} from './order-input';
import { parseCreateMenuItemInput } from './menu-item-input';
import { parseCreateBuffetItemInput } from './buffet-item-input';
import { parseCreateCustomerInput } from './customer-input';
import { prisma } from './prisma';
import { includesComandaNumber, parseComandaNumbers } from '../comanda-numbers';

type TransactionClient = Prisma.TransactionClient;

const orderItemSelect = {
  id: true,
  menuItemId: true,
  quantity: true,
  unitPrice: true,
  notes: true,
  status: true,
  version: true,
  menuItem: { select: { name: true } },
} satisfies Prisma.OrderItemSelect;

const orderWithItemsSelect = {
  id: true,
  comandaNumber: true,
  tableId: true,
  customerId: true,
  customerName: true,
  peopleCount: true,
  waiterId: true,
  status: true,
  total: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  items: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: orderItemSelect,
  },
} satisfies Prisma.OrderSelect;

type OrderWithItems = Prisma.OrderGetPayload<{ select: typeof orderWithItemsSelect }>;

export type OpenOrderSummary = Readonly<{
  id: string;
  comandaNumber: number | null;
  tableId: string | null;
  customerId: string | null;
  customerName: string | null;
  peopleCount: number | null;
  waiterId: string | null;
  status: 'OPEN';
  total: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  items: readonly Readonly<{
    id: string;
    menuItemId: string;
    name: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
    notes: string | null;
    status: string | null;
    version: number;
  }>[];
}>;

export type MenuItemSummary = Readonly<{
  id: string;
  name: string;
  category: string;
  price: string;
}>;

export type BuffetItemSummary = Readonly<{
  id: string;
  name: string;
  description: string | null;
}>;

export type TableSummary = Readonly<{
  id: string;
  number: number;
  capacity: number;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLOSING';
  version: number;
  updatedAt: string;
  openOrders: readonly Pick<OpenOrderSummary, 'id' | 'createdAt'>[];
}>;

export type CreatedOrderResult = Readonly<{
  order: OpenOrderSummary;
  replayed: boolean;
}>;

export type AddedOrderItemResult = Readonly<{
  item: OpenOrderSummary['items'][number];
  order: OpenOrderSummary;
  replayed: boolean;
}>;

function isUuidV7(value: unknown): value is string {
  return UuidV7Schema.safeParse(value).success;
}

function toOrderItemSummary(
  item: Prisma.OrderItemGetPayload<{ select: typeof orderItemSelect }>,
): OpenOrderSummary['items'][number] {
  return {
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.menuItem.name,
    quantity: item.quantity.toString(),
    unitPrice: item.unitPrice.toFixed(2),
    lineTotal: new Prisma.Decimal(item.unitPrice.toString()).mul(item.quantity).toFixed(2),
    notes: item.notes,
    status: item.status,
    version: item.version,
  };
}

function toOpenOrderSummary(order: {
  id: string;
  comandaNumber: number | null;
  tableId: string | null;
  customerId?: string | null;
  customerName?: string | null;
  peopleCount?: number | null;
  waiterId: string | null;
  total: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  items?: readonly Prisma.OrderItemGetPayload<{ select: typeof orderItemSelect }>[];
}): OpenOrderSummary {
  return {
    id: order.id,
    comandaNumber: order.comandaNumber,
    tableId: order.tableId,
    customerId: order.customerId ?? null,
    customerName: order.customerName ?? null,
    peopleCount: order.peopleCount ?? null,
    waiterId: order.waiterId,
    status: 'OPEN',
    total: order.total.toFixed(2),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    version: order.version,
    items: (order.items ?? []).map(toOrderItemSummary),
  };
}

function toMenuItemSummary(item: {
  id: string;
  name: string;
  price: Prisma.Decimal;
  category: { name: string };
}): MenuItemSummary {
  return {
    id: item.id,
    name: item.name,
    category: item.category.name,
    price: item.price.toFixed(2),
  };
}

function toBuffetItemSummary(item: {
  id: string;
  name: string;
  description: string | null;
}): BuffetItemSummary {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
  };
}

async function assertCurrentPrincipal(
  tx: TransactionClient,
  context: AuthenticatedServerContext,
): Promise<void> {
  const [user, restaurant] = await Promise.all([
    tx.user.findFirst({
      where: {
        id: context.userId,
        restaurantId: context.restaurantId,
        deletedAt: null,
      },
      select: { role: true },
    }),
    tx.restaurant.findFirst({
      where: { id: context.restaurantId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (!user || !restaurant || user.role !== context.role) {
    throw new ApiProblemError(
      401,
      'UNAUTHENTICATED',
      'Autenticação necessária',
      'É necessária uma sessão autenticada válida.',
    );
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Lists operational tables and their open order references from one database
 * transaction. Open orders take precedence over a stale FREE table status.
 */
export async function listTables(
  context: unknown,
  options: Readonly<{ updatedSince?: string; includeOpenOrders?: boolean }> = {},
  client: PrismaClient = prisma,
): Promise<readonly TableSummary[]> {
  const principal = requireOperationalReadAccess(context);
  const updatedSince =
    options.updatedSince === undefined
      ? undefined
      : UtcTimestampSchema.safeParse(options.updatedSince);
  if (updatedSince && !updatedSince.success) {
    throw ApiProblemError.validation([
      {
        path: 'updatedSince',
        code: 'invalid_timestamp',
        message: 'A data deve ser um timestamp UTC válido.',
      },
    ]);
  }
  const since = updatedSince?.success ? new Date(updatedSince.data) : undefined;
  const tableSelect = {
    id: true,
    number: true,
    capacity: true,
    status: true,
    version: true,
    updatedAt: true,
    ...(options.includeOpenOrders === false
      ? {}
      : {
          orders: {
            where: { status: 'OPEN', deletedAt: null },
            orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
            select: { id: true, createdAt: true },
          },
        }),
  } satisfies Prisma.TableSelect;

  return client.$transaction(
    async (tx) => {
      await assertCurrentPrincipal(tx, principal);
      const tables = await tx.table.findMany({
        where: {
          restaurantId: principal.restaurantId,
          deletedAt: null,
          ...(since === undefined
            ? {}
            : {
                OR: [
                  { updatedAt: { gt: since } },
                  {
                    orders: {
                      some: {
                        status: 'OPEN',
                        deletedAt: null,
                        updatedAt: { gt: since },
                      },
                    },
                  },
                ],
              }),
        },
        orderBy: [{ number: 'asc' }, { id: 'asc' }],
        select: tableSelect,
      });

      return tables.map((table) => ({
        id: table.id,
        number: table.number,
        capacity: table.capacity,
        status:
          table.status === 'FREE' && 'orders' in table && table.orders.length > 0
            ? 'OCCUPIED'
            : table.status,
        version: table.version,
        updatedAt: table.updatedAt.toISOString(),
        openOrders: ('orders' in table ? table.orders : []).map((order) => ({
          id: order.id,
          createdAt: order.createdAt.toISOString(),
        })),
      }));
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function listMenuItems(
  context: unknown,
  client: PrismaClient = prisma,
): Promise<readonly MenuItemSummary[]> {
  const principal = requireOperationalReadAccess(context);
  return client.$transaction(async (tx) => {
    await assertCurrentPrincipal(tx, principal);
    const items = await tx.menuItem.findMany({
      where: {
        restaurantId: principal.restaurantId,
        available: true,
        deletedAt: null,
        category: { restaurantId: principal.restaurantId, deletedAt: null },
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        price: true,
        category: { select: { name: true } },
      },
    });
    return items.map(toMenuItemSummary);
  });
}

export async function createMenuItem(
  context: unknown,
  body: unknown,
  client: PrismaClient = prisma,
): Promise<MenuItemSummary> {
  const principal = requirePermission(context, 'MENU_MANAGE');
  if (principal.role !== 'ADMIN') {
    throw new ApiProblemError(
      403,
      'FORBIDDEN',
      'Acesso negado',
      'Somente um administrador pode cadastrar produtos.',
    );
  }
  const input = parseCreateMenuItemInput(body);

  return client.$transaction(async (tx) => {
    await assertCurrentPrincipal(tx, principal);
    const duplicate = await tx.menuItem.findFirst({
      where: {
        restaurantId: principal.restaurantId,
        deletedAt: null,
        name: { equals: input.name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ApiProblemError(
        409,
        'MENU_ITEM_ALREADY_EXISTS',
        'Produto já cadastrado',
        'Já existe um produto ativo com esse nome.',
      );
    }

    const category =
      (await tx.menuCategory.findFirst({
        where: {
          restaurantId: principal.restaurantId,
          deletedAt: null,
          name: { equals: input.category, mode: 'insensitive' },
        },
        select: { id: true },
      })) ??
      (await tx.menuCategory.create({
        data: {
          id: createId(),
          restaurantId: principal.restaurantId,
          name: input.category,
        },
        select: { id: true },
      }));

    const item = await tx.menuItem.create({
      data: {
        id: createId(),
        restaurantId: principal.restaurantId,
        categoryId: category.id,
        name: input.name,
        price: input.price,
        available: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        category: { select: { name: true } },
      },
    });
    return toMenuItemSummary(item);
  });
}

export async function listBuffetItems(
  context: unknown,
  client: PrismaClient = prisma,
): Promise<readonly BuffetItemSummary[]> {
  const principal = requireOperationalReadAccess(context);
  return client.$transaction(async (tx) => {
    await assertCurrentPrincipal(tx, principal);
    const items = await tx.buffetItem.findMany({
      where: {
        restaurantId: principal.restaurantId,
        available: true,
        deletedAt: null,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
    return items.map(toBuffetItemSummary);
  });
}

export async function createBuffetItem(
  context: unknown,
  body: unknown,
  client: PrismaClient = prisma,
): Promise<BuffetItemSummary> {
  const principal = requirePermission(context, 'MENU_MANAGE');
  if (principal.role !== 'ADMIN') {
    throw new ApiProblemError(
      403,
      'FORBIDDEN',
      'Acesso negado',
      'Somente um administrador pode cadastrar produtos de buffet.',
    );
  }
  const input = parseCreateBuffetItemInput(body);

  return client.$transaction(async (tx) => {
    await assertCurrentPrincipal(tx, principal);
    const duplicate = await tx.buffetItem.findFirst({
      where: {
        restaurantId: principal.restaurantId,
        deletedAt: null,
        name: { equals: input.name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ApiProblemError(
        409,
        'BUFFET_ITEM_ALREADY_EXISTS',
        'Produto já cadastrado',
        'Já existe um produto de buffet ativo com esse nome.',
      );
    }

    const item = await tx.buffetItem.create({
      data: {
        id: createId(),
        restaurantId: principal.restaurantId,
        name: input.name,
        description: input.description,
        available: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
    return toBuffetItemSummary(item);
  });
}

export async function listOrders(
  context: unknown,
  options: Readonly<{ tableId?: string }> = {},
  client: PrismaClient = prisma,
): Promise<readonly OpenOrderSummary[]> {
  const principal = requireOperationalReadAccess(context);
  if (options.tableId !== undefined && !isUuidV7(options.tableId)) {
    throw ApiProblemError.validation([
      { path: 'tableId', code: 'invalid_uuid', message: 'Identificador inválido.' },
    ]);
  }

  return client.$transaction(
    async (tx) => {
      await assertCurrentPrincipal(tx, principal);
      const orders = await tx.order.findMany({
        where: {
          restaurantId: principal.restaurantId,
          status: 'OPEN',
          deletedAt: null,
          ...(options.tableId === undefined ? {} : { tableId: options.tableId }),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: orderWithItemsSelect,
      });
      return orders.map(toOpenOrderSummary);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

function orderMatchesCreate(
  order: {
    restaurantId: string;
    comandaNumber: number | null;
    tableId: string | null;
    customerId: string | null;
    customerName: string | null;
    peopleCount: number | null;
    deviceId: string | null;
    deletedAt: Date | null;
    status: string;
  },
  restaurantId: string,
  input: ReturnType<typeof parseCreateOrderInput>,
): boolean {
  return (
    order.restaurantId === restaurantId &&
    order.comandaNumber === input.comandaNumber &&
    order.tableId === input.tableId &&
    order.customerId === input.customerId &&
    order.customerName === input.customerName &&
    order.peopleCount === input.peopleCount &&
    order.deviceId === input.deviceId &&
    order.deletedAt === null &&
    order.status === 'OPEN'
  );
}

export async function createOpenOrder(
  context: unknown,
  body: unknown,
  client: PrismaClient = prisma,
): Promise<CreatedOrderResult> {
  const principal = requirePermission(context, 'ORDERS_CREATE');
  const input = parseCreateOrderInput(body);

  try {
    const result = await client.$transaction(
      async (tx) => {
        await assertCurrentPrincipal(tx, principal);
        const existing = await tx.order.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            restaurantId: true,
            comandaNumber: true,
            tableId: true,
            customerId: true,
            customerName: true,
            peopleCount: true,
            waiterId: true,
            status: true,
            total: true,
            createdAt: true,
            updatedAt: true,
            version: true,
            deviceId: true,
            deletedAt: true,
          },
        });

        if (existing) {
          if (!orderMatchesCreate(existing, principal.restaurantId, input)) {
            throw new ApiProblemError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Conflito de comanda',
              'O identificador já foi usado para outra criação.',
            );
          }
          return { order: existing, replayed: true };
        }

        if (input.comandaNumber !== null) {
          const restaurantSettings = await tx.restaurant.findFirst({
            where: { id: principal.restaurantId, deletedAt: null },
            select: { comandaNumbers: true },
          });
          if (
            !restaurantSettings ||
            !includesComandaNumber(
              parseComandaNumbers(restaurantSettings.comandaNumbers),
              input.comandaNumber,
            )
          ) {
            throw ApiProblemError.validation([
              {
                path: 'comandaNumber',
                code: 'number_not_configured',
                message: 'Esse número não está habilitado nas propriedades de comandas.',
              },
            ]);
          }
        }

        const table = input.tableId
          ? await tx.table.findFirst({
              where: {
                id: input.tableId,
                restaurantId: principal.restaurantId,
                deletedAt: null,
              },
              select: { id: true, status: true },
            })
          : null;
        if (input.tableId && !table) {
          throw new ApiProblemError(
            404,
            'TABLE_NOT_FOUND',
            'Mesa não encontrada',
            'A mesa solicitada não foi encontrada.',
          );
        }
        if (table?.status === 'RESERVED' || table?.status === 'CLOSING') {
          throw new ApiProblemError(
            409,
            'TABLE_UNAVAILABLE',
            'Mesa indisponível',
            'A mesa não pode receber novas comandas no estado atual.',
          );
        }

        const order = await tx.order.create({
          data: {
            id: input.id,
            restaurantId: principal.restaurantId,
            comandaNumber: input.comandaNumber,
            tableId: table?.id ?? null,
            customerId: input.customerId ?? null,
            customerName: input.customerName ?? null,
            peopleCount: input.peopleCount ?? null,
            status: 'OPEN',
            total: '0.00',
            deviceId: input.deviceId,
            version: 1,
          },
          select: {
            id: true,
            restaurantId: true,
            comandaNumber: true,
            tableId: true,
            customerId: true,
            customerName: true,
            peopleCount: true,
            waiterId: true,
            status: true,
            total: true,
            createdAt: true,
            updatedAt: true,
            version: true,
            deviceId: true,
            deletedAt: true,
          },
        });
        if (table && table.status !== 'OCCUPIED') {
          await tx.table.updateMany({
            where: { id: table.id, status: 'FREE' },
            data: { status: 'OCCUPIED', version: { increment: 1 } },
          });
        }
        return { order, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return { order: toOpenOrderSummary(result.order), replayed: result.replayed };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const existing = await client.order.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        restaurantId: true,
        comandaNumber: true,
        tableId: true,
        customerId: true,
        customerName: true,
        peopleCount: true,
        waiterId: true,
        status: true,
        total: true,
        createdAt: true,
        updatedAt: true,
        version: true,
        deviceId: true,
        deletedAt: true,
      },
    });
    if (existing && orderMatchesCreate(existing, principal.restaurantId, input)) {
      return { order: toOpenOrderSummary(existing), replayed: true };
    }
    if (input.comandaNumber !== null) {
      const numberConflict = await client.order.findFirst({
        where: {
          restaurantId: principal.restaurantId,
          comandaNumber: input.comandaNumber,
          status: 'OPEN',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (numberConflict) {
        throw new ApiProblemError(
          409,
          'COMANDA_NUMBER_TAKEN',
          'Número de comanda indisponível',
          'Esse número já está sendo usado por uma comanda aberta.',
        );
      }
    }
    throw new ApiProblemError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'Conflito de comanda',
      'O identificador já foi usado para outra criação.',
    );
  }
}

function orderItemMatchesAdd(
  item: {
    orderId: string;
    menuItemId: string;
    quantity: Prisma.Decimal;
    notes: string | null;
    deletedAt: Date | null;
    order: { restaurantId: string };
  },
  orderId: string,
  restaurantId: string,
  input: ReturnType<typeof parseAddOrderItemInput>,
): boolean {
  return (
    item.orderId === orderId &&
    item.order.restaurantId === restaurantId &&
    item.menuItemId === input.menuItemId &&
    item.quantity.equals(input.quantity) &&
    item.notes === input.notes &&
    item.deletedAt === null
  );
}

async function readOpenOrder(
  orderId: string,
  restaurantId: string,
  client: PrismaClient | TransactionClient,
): Promise<OrderWithItems | null> {
  return client.order.findFirst({
    where: { id: orderId, restaurantId, status: 'OPEN', deletedAt: null },
    select: orderWithItemsSelect,
  });
}

async function getIdempotentOrderItemResult(
  itemId: string,
  orderId: string,
  restaurantId: string,
  input: ReturnType<typeof parseAddOrderItemInput>,
  client: PrismaClient | TransactionClient,
): Promise<AddedOrderItemResult | null> {
  const existing = await client.orderItem.findUnique({
    where: { id: itemId },
    include: {
      menuItem: { select: { name: true } },
      order: { select: { id: true, restaurantId: true, status: true, deletedAt: true } },
    },
  });
  if (
    !existing ||
    existing.order.id !== orderId ||
    existing.order.status !== 'OPEN' ||
    existing.order.deletedAt !== null ||
    !orderItemMatchesAdd(
      { ...existing, order: { restaurantId: existing.order.restaurantId } },
      orderId,
      restaurantId,
      input,
    )
  ) {
    return null;
  }

  const order = await readOpenOrder(orderId, restaurantId, client);
  if (!order) return null;
  return {
    item: {
      id: existing.id,
      menuItemId: existing.menuItemId,
      name: existing.menuItem.name,
      quantity: existing.quantity.toString(),
      unitPrice: existing.unitPrice.toFixed(2),
      lineTotal: new Prisma.Decimal(existing.unitPrice.toString())
        .mul(existing.quantity)
        .toFixed(2),
      notes: existing.notes,
      status: existing.status,
      version: existing.version,
    },
    order: toOpenOrderSummary(order),
    replayed: true,
  };
}

export async function addItemToOpenOrder(
  context: unknown,
  orderId: string,
  body: unknown,
  client: PrismaClient = prisma,
): Promise<AddedOrderItemResult> {
  const principal = requirePermission(context, 'ORDER_ITEMS_ADD');
  if (!isUuidV7(orderId)) {
    throw ApiProblemError.validation([
      { path: 'orderId', code: 'invalid_uuid', message: 'Identificador inválido.' },
    ]);
  }
  const input = parseAddOrderItemInput(body);

  try {
    return await client.$transaction(
      async (tx) => {
        await assertCurrentPrincipal(tx, principal);
        const replay = await getIdempotentOrderItemResult(
          input.id,
          orderId,
          principal.restaurantId,
          input,
          tx,
        );
        if (replay) return replay;

        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            restaurantId: principal.restaurantId,
            status: 'OPEN',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!order) {
          throw new ApiProblemError(
            404,
            'ORDER_NOT_FOUND',
            'Comanda não encontrada',
            'A comanda aberta solicitada não foi encontrada.',
          );
        }

        const menuItem = await tx.menuItem.findFirst({
          where: {
            id: input.menuItemId,
            restaurantId: principal.restaurantId,
            available: true,
            deletedAt: null,
            category: { restaurantId: principal.restaurantId, deletedAt: null },
          },
          select: { id: true, name: true, price: true },
        });
        if (!menuItem) {
          throw new ApiProblemError(
            404,
            'MENU_ITEM_NOT_FOUND',
            'Produto indisponível',
            'O produto não está disponível para lançamento.',
          );
        }

        const quantity = new Prisma.Decimal(input.quantity);
        const lineTotal = menuItem.price.mul(quantity);
        const item = await tx.orderItem.create({
          data: {
            id: input.id,
            orderId,
            menuItemId: menuItem.id,
            quantity,
            unitPrice: menuItem.price,
            notes: input.notes,
            status: null,
            version: 1,
          },
          select: orderItemSelect,
        });
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: { total: { increment: lineTotal }, version: { increment: 1 } },
          select: orderWithItemsSelect,
        });
        return {
          item: toOrderItemSummary(item),
          order: toOpenOrderSummary(updatedOrder),
          replayed: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const replay = await getIdempotentOrderItemResult(
      input.id,
      orderId,
      principal.restaurantId,
      input,
      client,
    );
    if (replay) return replay;
    throw new ApiProblemError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'Conflito de item',
      'O identificador já foi usado para outro lançamento.',
    );
  }
}

function itemModificationConflict(): ApiProblemError {
  return new ApiProblemError(
    409,
    'ORDER_ITEM_CONFLICT',
    'Item alterado',
    'O item mudou ou já foi enviado à cozinha. Atualize a comanda antes de tentar novamente.',
  );
}

async function findEditableOrderItem(
  tx: TransactionClient,
  itemId: string,
  orderId: string,
  restaurantId: string,
) {
  const item = await tx.orderItem.findFirst({
    where: {
      id: itemId,
      orderId,
      deletedAt: null,
      order: { is: { restaurantId, status: 'OPEN', deletedAt: null } },
    },
    select: {
      id: true,
      orderId: true,
      quantity: true,
      unitPrice: true,
      notes: true,
      status: true,
      version: true,
    },
  });
  if (!item) {
    throw new ApiProblemError(
      404,
      'ORDER_ITEM_NOT_FOUND',
      'Item não encontrado',
      'O item editável não foi encontrado nesta comanda.',
    );
  }
  if (item.status !== null) throw itemModificationConflict();
  return item;
}

export async function updatePendingOrderItem(
  context: unknown,
  orderId: string,
  itemId: string,
  body: unknown,
  client: PrismaClient = prisma,
): Promise<Readonly<{ item: OpenOrderSummary['items'][number]; order: OpenOrderSummary }>> {
  const principal = requirePermission(context, 'ORDERS_EDIT');
  if (!isUuidV7(orderId) || !isUuidV7(itemId)) {
    throw ApiProblemError.validation([
      { path: 'id', code: 'invalid_uuid', message: 'Identificador inválido.' },
    ]);
  }
  const input = parseUpdateOrderItemInput(body);

  return client.$transaction(
    async (tx) => {
      await assertCurrentPrincipal(tx, principal);
      const current = await findEditableOrderItem(tx, itemId, orderId, principal.restaurantId);
      if (current.version !== input.expectedVersion) throw itemModificationConflict();

      const quantity = new Prisma.Decimal(input.quantity);
      const previousTotal = current.unitPrice.mul(current.quantity);
      const updatedTotal = current.unitPrice.mul(quantity);
      const changed = await tx.orderItem.updateMany({
        where: {
          id: itemId,
          orderId,
          version: input.expectedVersion,
          deletedAt: null,
          status: null,
          order: { is: { restaurantId: principal.restaurantId, status: 'OPEN', deletedAt: null } },
        },
        data: {
          quantity,
          notes: input.notes,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw itemModificationConflict();

      const updatedOrderCount = await tx.order.updateMany({
        where: {
          id: orderId,
          restaurantId: principal.restaurantId,
          status: 'OPEN',
          deletedAt: null,
        },
        data: {
          total: { increment: updatedTotal.minus(previousTotal) },
          version: { increment: 1 },
        },
      });
      if (updatedOrderCount.count !== 1) throw itemModificationConflict();

      const [updatedItem, order] = await Promise.all([
        tx.orderItem.findUniqueOrThrow({
          where: { id: itemId },
          select: orderItemSelect,
        }),
        readOpenOrder(orderId, principal.restaurantId, tx),
      ]);
      if (!order) throw itemModificationConflict();
      return { item: toOrderItemSummary(updatedItem), order: toOpenOrderSummary(order) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function deletePendingOrderItem(
  context: unknown,
  orderId: string,
  itemId: string,
  body: unknown,
  client: PrismaClient = prisma,
): Promise<Readonly<{ order: OpenOrderSummary }>> {
  const principal = requirePermission(context, 'ORDERS_EDIT');
  if (!isUuidV7(orderId) || !isUuidV7(itemId)) {
    throw ApiProblemError.validation([
      { path: 'id', code: 'invalid_uuid', message: 'Identificador inválido.' },
    ]);
  }
  const expectedVersion = parseDeleteOrderItemInput(body);

  return client.$transaction(
    async (tx) => {
      await assertCurrentPrincipal(tx, principal);
      const current = await findEditableOrderItem(tx, itemId, orderId, principal.restaurantId);
      if (current.version !== expectedVersion) throw itemModificationConflict();

      const removedTotal = current.unitPrice.mul(current.quantity);
      const deleted = await tx.orderItem.updateMany({
        where: {
          id: itemId,
          orderId,
          version: expectedVersion,
          deletedAt: null,
          status: null,
          order: { is: { restaurantId: principal.restaurantId, status: 'OPEN', deletedAt: null } },
        },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (deleted.count !== 1) throw itemModificationConflict();

      const updatedOrderCount = await tx.order.updateMany({
        where: {
          id: orderId,
          restaurantId: principal.restaurantId,
          status: 'OPEN',
          deletedAt: null,
        },
        data: {
          total: { decrement: removedTotal },
          version: { increment: 1 },
        },
      });
      if (updatedOrderCount.count !== 1) throw itemModificationConflict();

      const order = await readOpenOrder(orderId, principal.restaurantId, tx);
      if (!order) throw itemModificationConflict();
      return { order: toOpenOrderSummary(order) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function closeOrder(
  context: unknown,
  orderId: string,
  client: PrismaClient = prisma,
): Promise<OpenOrderSummary> {
  const principal = requirePermission(context, 'ORDERS_CLOSE');
  if (!isUuidV7(orderId)) {
    throw ApiProblemError.validation([
      { path: 'orderId', code: 'invalid_uuid', message: 'Identificador inválido.' },
    ]);
  }

  return client.$transaction(
    async (tx) => {
      await assertCurrentPrincipal(tx, principal);
      const order = await readOpenOrder(orderId, principal.restaurantId, tx);
      if (!order) {
        throw new ApiProblemError(
          404,
          'ORDER_NOT_FOUND',
          'Comanda não encontrada',
          'A comanda solicitada não foi encontrada.',
        );
      }
      if (order.status === 'CLOSED') {
        throw new ApiProblemError(
          409,
          'ORDER_ALREADY_CLOSED',
          'Comanda já fechada',
          'Essa comanda já foi fechada previamente.',
        );
      }

      // Update order status to CLOSED
      const closedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CLOSED', closedAt: new Date(), version: { increment: 1 } },
        select: orderWithItemsSelect,
      });

      return toOpenOrderSummary(closedOrder);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

/**
 * Registra um pagamento em uma comanda aberta
 * @param context - Contexto de autenticação do servidor
 * @param orderId - ID da comanda
 * @param body - Dados do pagamento: { amount: string, method: 'dinheiro' | 'cartão Crédito' | 'cartão Débito' | 'PIX' }
 * @param client - Cliente Prisma (opcional, usa o global se não fornecido)
 * @returns Objeto com o resumo da ordem e do pagamento
 */
export async function registerPayment(
  context: unknown,
  orderId: string,
  body: unknown,
  client: PrismaClient = prisma,
): Promise<{ order: OpenOrderSummary; payment: PaymentSummary }> {
  const principal = requirePermission(context, 'PAYMENTS_RECEIVE');
  if (!isUuidV7(orderId)) {
    throw ApiProblemError.validation([
      { path: 'orderId', code: 'invalid_uuid', message: 'Identificador inválido.' },
    ]);
  }

  const input = parseRegisterPaymentInput(body);

  return client.$transaction(
    async (tx) => {
      await assertCurrentPrincipal(tx, principal);
      const order = await readOpenOrder(orderId, principal.restaurantId, tx);
      if (!order) {
        throw new ApiProblemError(
          404,
          'ORDER_NOT_FOUND',
          'Comanda não encontrada',
          'A comanda solicitada não foi encontrada.',
        );
      }
      if (order.status === 'CLOSED') {
        throw new ApiProblemError(
          409,
          'ORDER_ALREADY_CLOSED',
          'Comanda já fechada',
          'Não é possível registrar pagamento em comanda já fechada.',
        );
      }

      // Validate the payment method
      const method = input.method;
      const allowedMethods = ['dinheiro', 'cartão Crédito', 'cartão Débito', 'PIX'];
      if (!allowedMethods.includes(method)) {
        throw new ApiProblemError(
          400,
          'INVALID_PAYMENT_METHOD',
          'Método de pagamento inválido',
          'Método de pagamento não é válido. Use: dinheiro, cartão Crédito, cartão Débito ou PIX.',
        );
      }

      const amount = new Prisma.Decimal(input.amount);
      const orderTotal = order.total;

      // Validate the amount
      if (amount.lte(new Prisma.Decimal('0'))) {
        throw new ApiProblemError(
          400,
          'INVALID_AMOUNT',
          'Valor inválido',
          'O valor do pagamento deve ser maior que zero.',
        );
      }
      if (amount.gt(orderTotal)) {
        throw new ApiProblemError(
          400,
          'AMOUNT_EXCEEDS_TOTAL',
          'Valor acima do total',
          'O valor do pagamento não pode exceder o total da comanda.',
        );
      }

      // Troco só existe quando o valor pago supera o total; como valores acima
      // do total são recusados, o troco é sempre zero neste fluxo.
      const change = new Prisma.Decimal(0);

      // If payment equals total, mark order as closed
      const isFullyPaid = amount.eq(orderTotal);
      const finalStatus: 'OPEN' | 'CLOSED' = isFullyPaid ? 'CLOSED' : 'OPEN';
      if (isFullyPaid && order.tableId) {
        // Also free the table when the order is fully paid.
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'FREE', version: { increment: 1 } },
        });
      }

      const finalOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: finalStatus,
          ...(isFullyPaid ? { closedAt: new Date() } : {}),
          version: { increment: 1 },
        },
        select: orderWithItemsSelect,
      });

      return {
        order: toOpenOrderSummary(finalOrder),
        payment: {
          id: createId(),
          orderId,
          amount: amount.toFixed(2),
          method,
          change: change.toFixed(2),
          status: isFullyPaid ? 'completed' : 'partial',
          createdAt: new Date().toISOString(),
        } as PaymentSummary,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

function parseRegisterPaymentInput(body: unknown): { amount: string; method: string } {
  const parsed = RegisterPaymentInputSchema.parse(body);
  return {
    amount: parsed.amount,
    method: parsed.method,
  };
}

const RegisterPaymentInputSchema = z.object({
  amount: z.string().refine((val) => /^\d{1,10}(\.\d{1,2})?$/.test(val), {
    message: 'Valor deve ser um número decimal válido.',
  }),
  method: z.enum(['dinheiro', 'cartão Crédito', 'cartão Débito', 'PIX']),
});

type PaymentSummary = Readonly<{
  id: string;
  orderId: string;
  amount: string;
  method: string;
  change: string;
  status: 'completed' | 'partial';
  createdAt: string;
}>;


// ─── Customer ────────────────────────────────────────────────────────────────

export type CustomerSummary = Readonly<{
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}>;

function toCustomerSummary(c: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}): CustomerSummary {
  return { id: c.id, name: c.name, phone: c.phone, email: c.email, notes: c.notes };
}

export async function listCustomers(
  context: unknown,
  query: Readonly<{ search?: string }> = {},
  client: PrismaClient = prisma,
): Promise<readonly CustomerSummary[]> {
  const principal = requireOperationalReadAccess(context);
  return client.$transaction(async (tx) => {
    await assertCurrentPrincipal(tx, principal);
    const customers = await tx.customer.findMany({
      where: {
        restaurantId: principal.restaurantId,
        deletedAt: null,
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, phone: true, email: true, notes: true },
    });
    return customers.map(toCustomerSummary);
  });
}

export async function createCustomer(
  context: unknown,
  body: unknown,
  client: PrismaClient = prisma,
): Promise<CustomerSummary> {
  const principal = requirePermission(context, 'ORDERS_CREATE');
  const input = parseCreateCustomerInput(body);
  return client.$transaction(async (tx) => {
    await assertCurrentPrincipal(tx, principal);
    const duplicate = await tx.customer.findFirst({
      where: {
        restaurantId: principal.restaurantId,
        deletedAt: null,
        name: { equals: input.name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) {
      // Return the existing customer instead of erroring — allows idempotent use
      const existing = await tx.customer.findUnique({
        where: { id: duplicate.id },
        select: { id: true, name: true, phone: true, email: true, notes: true },
      });
      if (existing) return toCustomerSummary(existing);
    }
    const customer = await tx.customer.create({
      data: {
        id: createId(),
        restaurantId: principal.restaurantId,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,
        version: 1,
      },
      select: { id: true, name: true, phone: true, email: true, notes: true },
    });
    return toCustomerSummary(customer);
  });
}

// ─── Update order details (customer + people) ─────────────────────────────────

export async function updateOrderDetails(
  context: unknown,
  orderId: string,
  body: unknown,
  client: PrismaClient = prisma,
): Promise<OpenOrderSummary> {
  const principal = requirePermission(context, 'ORDERS_CREATE');
  if (!isUuidV7(orderId)) {
    throw ApiProblemError.validation([
      { path: 'orderId', code: 'invalid_uuid', message: 'Identificador de comanda inválido.' },
    ]);
  }
  const input = parseUpdateOrderDetailsInput(body);

  return client.$transaction(async (tx) => {
    await assertCurrentPrincipal(tx, principal);
    const order = await readOpenOrder(orderId, principal.restaurantId, tx);
    if (!order) {
      throw new ApiProblemError(
        404,
        'ORDER_NOT_FOUND',
        'Comanda não encontrada',
        'A comanda não existe ou já foi fechada.',
      );
    }
    // Validate customerId if provided
    if (input.customerId !== null) {
      const customer = await tx.customer.findFirst({
        where: {
          id: input.customerId,
          restaurantId: principal.restaurantId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!customer) {
        throw ApiProblemError.validation([
          { path: 'customerId', code: 'not_found', message: 'Cliente não encontrado.' },
        ]);
      }
    }
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        customerId: input.customerId,
        customerName: input.customerName,
        peopleCount: input.peopleCount,
        version: { increment: 1 },
      },
      select: orderWithItemsSelect,
    });
    return toOpenOrderSummary(updated);
  });
}
