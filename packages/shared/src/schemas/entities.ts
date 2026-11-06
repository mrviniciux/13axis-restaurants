import { z } from "zod";
import { MoneySchema, QuantitySchema, SyncMetadataSchema } from "./common.js";
import { RoleSchema } from "./access.js";

export const TableStatusSchema = z.enum(["FREE", "OCCUPIED", "RESERVED", "CLOSING"]);
export type TableStatus = z.infer<typeof TableStatusSchema>;

export const OrderStatusSchema = z.enum(["OPEN", "CLOSED"]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderItemStatusSchema = z.enum(["SENT", "PREPARING", "READY", "SERVED"]);
export type OrderItemStatus = z.infer<typeof OrderItemStatusSchema>;

export const RestaurantSchema = SyncMetadataSchema.extend({
  name: z.string().min(1),
});
export type Restaurant = z.infer<typeof RestaurantSchema>;

export const UserSchema = SyncMetadataSchema.extend({
  restaurantId: SyncMetadataSchema.shape.id,
  name: z.string().min(1),
  email: z.email(),
  role: RoleSchema,
});
export type User = z.infer<typeof UserSchema>;

export const TableSchema = SyncMetadataSchema.extend({
  restaurantId: SyncMetadataSchema.shape.id,
  number: z.number().int().positive(),
  capacity: z.number().int().positive(),
  status: TableStatusSchema,
  location: z.string().nullable(),
});
export type RestaurantTable = z.infer<typeof TableSchema>;

export const MenuCategorySchema = SyncMetadataSchema.extend({
  restaurantId: SyncMetadataSchema.shape.id,
  name: z.string().min(1),
});
export type MenuCategory = z.infer<typeof MenuCategorySchema>;

export const MenuItemSchema = SyncMetadataSchema.extend({
  restaurantId: SyncMetadataSchema.shape.id,
  categoryId: SyncMetadataSchema.shape.id,
  name: z.string().min(1),
  price: MoneySchema,
  description: z.string().nullable(),
  image: z.string().nullable(),
  code: z.string().nullable(),
  available: z.boolean(),
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

export const OrderSchema = SyncMetadataSchema.extend({
  restaurantId: SyncMetadataSchema.shape.id,
  tableId: SyncMetadataSchema.shape.id,
  waiterId: SyncMetadataSchema.shape.id.nullable(),
  status: OrderStatusSchema,
  total: MoneySchema,
  closedAt: SyncMetadataSchema.shape.deletedAt,
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderItemSchema = SyncMetadataSchema.extend({
  orderId: SyncMetadataSchema.shape.id,
  menuItemId: SyncMetadataSchema.shape.id,
  quantity: QuantitySchema,
  unitPrice: MoneySchema,
  variations: z.record(z.string(), z.unknown()).nullable(),
  notes: z.string().nullable(),
  status: OrderItemStatusSchema.nullable(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;
