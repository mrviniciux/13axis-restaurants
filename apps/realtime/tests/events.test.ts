import { describe, expect, it, vi } from "vitest";
import { restaurantRoleRoom } from "../src/authorization.js";
import { parseRealtimeEvent } from "../src/events.js";
import { publishDomainEvent } from "../src/server.js";

const restaurantId = "018f47a2-7b6c-7abc-8def-1123456789ab";
const orderId = "018f47a2-7b6c-7abc-8def-2123456789ab";
const tableId = "018f47a2-7b6c-7abc-8def-3123456789ab";

const createdPayload = {
  eventId: "018f47a2-7b6c-7abc-8def-4123456789ab",
  schemaVersion: 1 as const,
  restaurantId,
  occurredAt: "2026-01-01T12:00:00.000Z",
  aggregate: { type: "order", id: orderId, version: 1 },
  data: { orderId, tableId },
};

describe("realtime event contracts", () => {
  it("validates the documented envelope and rejects unknown payload fields", () => {
    expect(parseRealtimeEvent("order:created", createdPayload)).toEqual(createdPayload);
    expect(() => parseRealtimeEvent("order:created", {
      ...createdPayload,
      restaurantId: "not-an-id",
      data: { ...createdPayload.data, isAdmin: true },
    })).toThrow();
  });

  it("publishes only to the per-role rooms allowed for that event", () => {
    const emit = vi.fn();
    const to = vi.fn((_rooms: string | string[]) => ({ emit }));
    publishDomainEvent({ to } as never, "order:item:added", {
      ...createdPayload,
      aggregate: { type: "order", id: orderId, version: 2 },
      data: {
        orderId,
        tableId,
        item: {
          id: "018f47a2-7b6c-7abc-8def-5123456789ab",
          createdAt: "2026-01-01T12:00:00.000Z",
          updatedAt: "2026-01-01T12:00:00.000Z",
          version: 1,
          lastSyncedAt: null,
          deviceId: null,
          deletedAt: null,
          orderId,
          menuItemId: "018f47a2-7b6c-7abc-8def-6123456789ab",
          quantity: "1",
          unitPrice: "12.50",
          variations: null,
          notes: null,
          status: "SENT",
        },
      },
    });

    expect(to).toHaveBeenCalledOnce();
    const rooms = to.mock.calls[0]?.[0];
    expect(rooms).toEqual(expect.arrayContaining([
      restaurantRoleRoom(restaurantId, "KITCHEN"),
      restaurantRoleRoom(restaurantId, "WAITER"),
    ]));
    expect(rooms).not.toEqual(expect.arrayContaining([
      restaurantRoleRoom(restaurantId, "CASHIER"),
    ]));
    expect(emit).toHaveBeenCalledWith("order:item:added", expect.any(Object));
  });

  it("publishes order changes to operational roles for snapshot refresh", () => {
    const emit = vi.fn();
    const to = vi.fn((_rooms: string | string[]) => ({ emit }));
    publishDomainEvent({ to } as never, "order:changed", {
      ...createdPayload,
      aggregate: { type: "order", id: orderId, version: 3 },
      data: { orderId },
    });

    expect(emit).toHaveBeenCalledWith(
      "order:changed",
      expect.objectContaining({ aggregate: { type: "order", id: orderId, version: 3 } }),
    );
    expect(to).toHaveBeenCalledWith(
      expect.arrayContaining([
        restaurantRoleRoom(restaurantId, "ADMIN"),
        restaurantRoleRoom(restaurantId, "WAITER"),
      ]),
    );
  });

  it("rejects arbitrary changes to prevent leaking unapproved fields", () => {
    expect(() => parseRealtimeEvent("menu:updated", {
      ...createdPayload,
      aggregate: { type: "menuItem", id: orderId, version: 1 },
      data: { itemId: orderId, changes: { available: true, costPrice: "1.00" } },
    })).toThrow();
  });
});
