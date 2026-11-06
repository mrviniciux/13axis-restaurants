import {
  MenuItemSchema,
  MoneySchema,
  OrderItemSchema,
  OrderItemStatusSchema,
  OrderStatusSchema,
  TableStatusSchema,
  UtcTimestampSchema,
  UuidV7Schema,
} from "@mudra/shared";
import { z } from "zod";

const EnvelopeSchema = z.object({
  eventId: UuidV7Schema,
  schemaVersion: z.literal(1),
  restaurantId: UuidV7Schema,
  occurredAt: UtcTimestampSchema,
  aggregate: z.object({
    type: z.enum(["order", "orderItem", "table", "menuItem"]),
    id: UuidV7Schema,
    version: z.number().int().positive(),
  }).strict(),
  mutationId: UuidV7Schema.optional(),
}).strict();

const OrderIdSchema = UuidV7Schema;
const TableIdSchema = UuidV7Schema;

const OrderChangesSchema = z.object({
  tableId: TableIdSchema.optional(),
  waiterId: UuidV7Schema.nullable().optional(),
  status: OrderStatusSchema.optional(),
  total: MoneySchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "changes must contain at least one allowed field",
});

const MenuItemChangesSchema = MenuItemSchema.pick({
  categoryId: true,
  name: true,
  price: true,
  description: true,
  image: true,
  code: true,
  available: true,
}).partial().strict().refine((value) => Object.keys(value).length > 0, {
  message: "changes must contain at least one allowed field",
});

function eventSchema<T extends z.ZodType>(aggregateType: "order" | "orderItem" | "table" | "menuItem", data: T) {
  return EnvelopeSchema.extend({
    aggregate: EnvelopeSchema.shape.aggregate.extend({ type: z.literal(aggregateType) }),
    data,
  }).strict();
}

export const RealtimeEventSchemas = {
  "order:created": eventSchema("order", z.object({
    orderId: OrderIdSchema,
    tableId: TableIdSchema,
  }).strict()),
  "order:changed": eventSchema("order", z.object({
    orderId: OrderIdSchema,
  }).strict()),
  "order:item:added": eventSchema("order", z.object({
    orderId: OrderIdSchema,
    tableId: TableIdSchema,
    item: OrderItemSchema,
  }).strict()),
  "order:item:status": eventSchema("orderItem", z.object({
    orderId: OrderIdSchema,
    itemId: UuidV7Schema,
    status: OrderItemStatusSchema,
  }).strict()),
  "order:updated": eventSchema("order", z.object({
    orderId: OrderIdSchema,
    changes: OrderChangesSchema,
  }).strict()),
  "order:closed": eventSchema("order", z.object({
    orderId: OrderIdSchema,
    tableId: TableIdSchema,
  }).strict()),
  "table:status": eventSchema("table", z.object({
    tableId: TableIdSchema,
    status: TableStatusSchema,
  }).strict()),
  "payment:processed": eventSchema("order", z.object({
    orderId: OrderIdSchema,
    amount: MoneySchema,
    method: z.string().min(1).max(40),
  }).strict()),
  "menu:updated": eventSchema("menuItem", z.object({
    itemId: UuidV7Schema,
    changes: MenuItemChangesSchema,
  }).strict()),
} as const;

export type RealtimeEventName = keyof typeof RealtimeEventSchemas;
export type RealtimeEventPayload<Name extends RealtimeEventName> =
  z.infer<(typeof RealtimeEventSchemas)[Name]>;

export function parseRealtimeEvent<Name extends RealtimeEventName>(
  name: Name,
  payload: unknown,
): RealtimeEventPayload<Name> {
  return RealtimeEventSchemas[name].parse(payload) as RealtimeEventPayload<Name>;
}
