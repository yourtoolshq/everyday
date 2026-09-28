import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { notFound } from "@yourtoolshq/server/errors";

import { toTRPCError } from "./trpc-errors";

describe("taxbook toTRPCError", () => {
  it("maps AppError codes used by record operations", () => {
    expect(toTRPCError(notFound("Record not found."))).toMatchObject({
      code: "NOT_FOUND",
      message: "Record not found.",
    });
    expect(toTRPCError(new Error("secret"))).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong.",
    });
    expect(toTRPCError(new Error("secret"))).toBeInstanceOf(TRPCError);
  });
});
