import { describe, expect, it } from "vitest";
import { ApiProblemError, problemResponse } from "./problem";

describe("problemResponse", () => {
  it("uses the RFC 9457 media type and a safe API problem body", async () => {
    const response = problemResponse(
      ApiProblemError.validation([
        {
          path: "tableId",
          code: "invalid_uuid",
          message: "Identificador inválido.",
        },
      ]),
      "/api/orders?secret=ignored",
    );

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    await expect(response.json()).resolves.toMatchObject({
      type: "urn:13axis:problem:validation_failed",
      title: "Dados inválidos",
      status: 422,
      instance: "/api/orders",
      code: "VALIDATION_FAILED",
      errors: [{ path: "tableId", code: "invalid_uuid" }],
    });
  });

  it("does not expose unexpected exception messages", async () => {
    const response = problemResponse(new Error("secret SQL/password"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.detail).not.toContain("secret");
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
