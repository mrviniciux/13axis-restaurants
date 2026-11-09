import { describe, expect, it } from "vitest";
import { parseOrdersQuery } from "./orders-query";
import { ApiProblemError } from "./problem";

describe("parseOrdersQuery", () => {
  it("accepts open-order status and a UUID v7 table filter", () => {
    expect(
      parseOrdersQuery(
        new URL(
          "https://13axis.example/api/orders?status=OPEN&tableId=0192f4a8-2c3d-7abc-8def-0123456789ab",
        ),
      ),
    ).toEqual({ tableId: "0192f4a8-2c3d-7abc-8def-0123456789ab" });
  });

  it("rejects closed orders, unknown filters, invalid IDs, and duplicate parameters", () => {
    for (const query of [
      "?status=CLOSED",
      "?extra=1",
      "?tableId=invalid",
      "?status=OPEN&status=OPEN",
    ]) {
      expect(() =>
        parseOrdersQuery(new URL(`https://13axis.example/api/orders${query}`)),
      ).toThrow(ApiProblemError);
    }
  });
});
