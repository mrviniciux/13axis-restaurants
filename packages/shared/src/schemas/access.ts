import { z } from "zod";

/**
 * SCALE corresponds to the "Balança" profile in the profile table. Its RBAC
 * permissions are not specified in section 4.2, so no permissions are granted
 * here until that mapping is decided.
 */
export const RoleSchema = z.enum([
  "ADMIN",
  "MANAGER",
  "WAITER",
  "CASHIER",
  "KITCHEN",
  "SCALE",
]);
export type Role = z.infer<typeof RoleSchema>;

export const PermissionSchema = z.enum([
  "MENU_MANAGE",
  "INVENTORY_MANAGE",
  "RESERVATIONS_MANAGE",
  "CASH_OPERATE",
  "EMPLOYEES_MANAGE",
  "REPORTS_VIEW",
  "ORDERS_CREATE",
  "ORDERS_EDIT",
  "ORDER_ITEMS_ADD",
  "TABLE_TRANSFER",
  "PAYMENTS_RECEIVE",
  "ORDERS_CLOSE",
  "KITCHEN_ORDERS_VIEW",
  "ORDER_ITEMS_STATUS_UPDATE",
]);
export type Permission = z.infer<typeof PermissionSchema>;

const allPermissions: readonly Permission[] = PermissionSchema.options;

/** Explicit grants from specification section 4.2; this is not backend auth. */
export const ROLE_PERMISSIONS = {
  ADMIN: allPermissions,
  MANAGER: [
    "MENU_MANAGE",
    "INVENTORY_MANAGE",
    "RESERVATIONS_MANAGE",
    "CASH_OPERATE",
    "EMPLOYEES_MANAGE",
    "REPORTS_VIEW",
  ],
  WAITER: [
    "ORDERS_CREATE",
    "ORDERS_EDIT",
    "ORDER_ITEMS_ADD",
    "TABLE_TRANSFER",
    "PAYMENTS_RECEIVE",
  ],
  CASHIER: ["CASH_OPERATE", "PAYMENTS_RECEIVE", "ORDERS_CLOSE", "REPORTS_VIEW"],
  KITCHEN: ["KITCHEN_ORDERS_VIEW", "ORDER_ITEMS_STATUS_UPDATE"],
  SCALE: [],
} as const satisfies Readonly<Record<Role, readonly Permission[]>>;

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].some((granted) => granted === permission);
}
