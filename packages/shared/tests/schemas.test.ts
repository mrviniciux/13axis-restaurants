import { describe, expect, it } from "vitest";
import {
  createId,
  hasPermission,
  MenuItemSchema,
  OrderItemSchema,
  OrderSchema,
  ROLE_PERMISSIONS,
  TableSchema,
  UuidV7Schema,
} from "../src/index.js";

const id = "0192f4a8-2c3d-7abc-8def-0123456789ab";
const timestamp = "2026-11-02T18:00:00.000Z";
const metadata = {
  id,
  createdAt: timestamp,
  updatedAt: timestamp,
  version: 1,
  lastSyncedAt: null,
  deviceId: null,
  deletedAt: null,
};

describe("shared identifiers and access schemas", () => {
  it("generates and validates UUID v7 identifiers", () => {
    expect(UuidV7Schema.parse(createId())).toMatch(/-7[0-9a-f]{3}-/i);
    expect(UuidV7Schema.safeParse("0192f4a8-2c3d-4abc-8def-0123456789ab").success).toBe(false);
  });

  it("keeps grants aligned with the documented RBAC and leaves SCALE unresolved", () => {
    expect(hasPermission("WAITER", "TABLE_TRANSFER")).toBe(true);
    expect(hasPermission("WAITER", "ORDERS_CLOSE")).toBe(false);
    expect(ROLE_PERMISSIONS.SCALE).toEqual([]);
    expect(hasPermission("ADMIN", "KITCHEN_ORDERS_VIEW")).toBe(true);
  });
});

describe("MVP mesa/comanda schemas", () => {
  it("accepts a table with a documented status", () => {
    expect(
      TableSchema.parse({
        ...metadata,
        restaurantId: id,
        number: 69,
        capacity: 4,
        status: "OCCUPIED",
        location: null,
      }).status,
    ).toBe("OCCUPIED");
  });

  it("rejects a negative table number", () => {
    expect(
      TableSchema.safeParse({
        ...metadata,
        restaurantId: id,
        number: -1,
        capacity: 4,
        status: "FREE",
        location: null,
      }).success,
    ).toBe(false);
  });

  it("accepts a menu item with exact decimal price text", () => {
    expect(
      MenuItemSchema.parse({
        ...metadata,
        restaurantId: id,
        categoryId: id,
        name: "Suco",
        price: "12.50",
        description: null,
        image: null,
        code: null,
        available: true,
      }).price,
    ).toBe("12.50");
  });

  it("accepts an open order and fractional order-item quantity", () => {
    expect(
      OrderSchema.parse({
        ...metadata,
        restaurantId: id,
        tableId: id,
        waiterId: null,
        status: "OPEN",
        total: "0.00",
        closedAt: null,
      }).status,
    ).toBe("OPEN");

    expect(
      OrderItemSchema.parse({
        ...metadata,
        orderId: id,
        menuItemId: id,
        quantity: "0.250",
        unitPrice: "9.90",
        variations: null,
        notes: null,
        status: null,
      }).quantity,
    ).toBe("0.250");
  });

  it("allows multiple open orders for one table when their UUID v7 identities differ", () => {
    const tableId = createId();
    const orders = [createId(), createId()].map((orderId) =>
      OrderSchema.parse({
        ...metadata,
        id: orderId,
        restaurantId: id,
        tableId,
        waiterId: null,
        status: "OPEN",
        total: "0.00",
        closedAt: null,
      }),
    );

    expect(orders[0].tableId).toBe(orders[1].tableId);
    expect(orders[0].id).not.toBe(orders[1].id);
  });
});
