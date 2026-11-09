import type { Role } from "@13axis/shared";
import type { RealtimeEventName } from "./events.js";

const RESTAURANT_ROOM_ROLES = [
  "ADMIN",
  "MANAGER",
  "WAITER",
  "CASHIER",
  "KITCHEN",
] as const satisfies readonly Role[];

const EVENT_ROLE_ALLOWLIST = {
  "order:created": ["ADMIN", "MANAGER", "WAITER", "CASHIER", "KITCHEN"],
  "order:changed": ["ADMIN", "MANAGER", "WAITER", "CASHIER", "KITCHEN"],
  "order:item:added": ["ADMIN", "MANAGER", "WAITER", "KITCHEN"],
  "order:item:status": ["ADMIN", "MANAGER", "WAITER", "KITCHEN"],
  "order:updated": ["ADMIN", "MANAGER", "WAITER", "CASHIER", "KITCHEN"],
  "order:closed": ["ADMIN", "MANAGER", "WAITER", "CASHIER", "KITCHEN"],
  "table:status": ["ADMIN", "MANAGER", "WAITER", "CASHIER", "KITCHEN"],
  "payment:processed": ["ADMIN", "MANAGER"],
  "menu:updated": ["ADMIN", "MANAGER", "WAITER"],
} as const satisfies Readonly<Record<RealtimeEventName, readonly Role[]>>;

export function restaurantRoom(restaurantId: string): string {
  return `restaurant:${restaurantId}`;
}

export function kitchenRoom(restaurantId: string): string {
  return `${restaurantRoom(restaurantId)}:kitchen`;
}

/** Internal per-role rooms allow event-specific RBAC without trusting client room names. */
export function restaurantRoleRoom(restaurantId: string, role: Role): string {
  return `${restaurantRoom(restaurantId)}:role:${role}`;
}

export function canJoinRestaurantRoom(role: Role): boolean {
  return RESTAURANT_ROOM_ROLES.includes(
    role as (typeof RESTAURANT_ROOM_ROLES)[number],
  );
}

export function canReceiveEvent(role: Role, event: RealtimeEventName): boolean {
  return (EVENT_ROLE_ALLOWLIST[event] as readonly Role[]).includes(role);
}

export function roomsForIdentity(identity: {
  restaurantId: string;
  role: Role;
}): string[] {
  if (!canJoinRestaurantRoom(identity.role)) return [];

  const rooms = [
    restaurantRoom(identity.restaurantId),
    restaurantRoleRoom(identity.restaurantId, identity.role),
  ];
  if (identity.role === "KITCHEN")
    rooms.push(kitchenRoom(identity.restaurantId));
  return rooms;
}

export function rolesForEvent(event: RealtimeEventName): readonly Role[] {
  return EVENT_ROLE_ALLOWLIST[event];
}
