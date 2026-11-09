import { describe, expect, it } from "vitest";
import { parseTablesQuery } from "./tables-query";
import { ApiProblemError } from "./problem";

describe("parseTablesQuery", () => {
  it("accepts an optional UTC updatedSince timestamp", () => {
    expect(
      parseTablesQuery(
        new URL(
          "https://13axis.example/api/tables?updatedSince=2026-11-02T18:30:00.000Z",
        ),
      ),
    ).toEqual({ updatedSince: "2026-11-02T18:30:00.000Z" });
    expect(
      parseTablesQuery(new URL("https://13axis.example/api/tables")),
    ).toEqual({});
  });

  it("rejects malformed, duplicate, and unknown query parameters", () => {
    for (const query of [
      "?updatedSince=tomorrow",
      "?unknown=1",
      "?updatedSince=2026-11-02T18:30:00.000Z&updatedSince=2026-11-02T18:30:01.000Z",
    ]) {
      expect(() =>
        parseTablesQuery(new URL(`https://13axis.example/api/tables${query}`)),
      ).toThrow(ApiProblemError);
    }
  });
});
