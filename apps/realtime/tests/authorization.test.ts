import { describe, expect, it } from "vitest";
import {
  canJoinRestaurantRoom,
  canReceiveEvent,
  kitchenRoom,
  restaurantRoleRoom,
  restaurantRoom,
  roomsForIdentity,
} from "../src/authorization.js";

const restaurantId = "018f47a2-7b6c-7abc-8def-1123456789ab";

describe("restaurant-scoped room and event authorization", () => {
  it("derives main and kitchen rooms only from verified identity", () => {
    expect(roomsForIdentity({ restaurantId, role: "WAITER" })).toEqual([
      restaurantRoom(restaurantId),
      restaurantRoleRoom(restaurantId, "WAITER"),
    ]);
    expect(roomsForIdentity({ restaurantId, role: "KITCHEN" })).toEqual([
      restaurantRoom(restaurantId),
      restaurantRoleRoom(restaurantId, "KITCHEN"),
      kitchenRoom(restaurantId),
    ]);
  });

  it("does not grant rooms to the currently unmapped SCALE role", () => {
    expect(canJoinRestaurantRoom("SCALE")).toBe(false);
    expect(roomsForIdentity({ restaurantId, role: "SCALE" })).toEqual([]);
  });

  it("applies explicit event role allowlists", () => {
    expect(canReceiveEvent("KITCHEN", "order:item:added")).toBe(true);
    expect(canReceiveEvent("CASHIER", "order:item:added")).toBe(false);
    expect(canReceiveEvent("WAITER", "menu:updated")).toBe(true);
    expect(canReceiveEvent("KITCHEN", "menu:updated")).toBe(false);
  });
});
