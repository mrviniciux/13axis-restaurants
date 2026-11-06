import { describe, expect, it } from "vitest";
import { demoKitchenTickets } from "./demo-data";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("formats Brazilian reais for the back-office", () => {
    expect(formatCurrency(1234.5)).toBe("R$\u00a01.234,50");
  });
});

describe("demo kitchen tickets", () => {
  it("distinguishes multiple open checks at the same table", () => {
    const sameTable = demoKitchenTickets.filter((ticket) => ticket.table === "Mesa 08");
    const checkIds = new Set(sameTable.map((ticket) => ticket.checkId));

    expect(sameTable).toHaveLength(2);
    expect(checkIds.size).toBe(2);
  });
});
