import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";

import { conflict, notFound } from "@yourtoolshq/server/errors";

import { toTRPCError } from "./trpc-errors";

describe("toTRPCError", () => {
  it("maps not_found and conflict without exposing unexpected internals", () => {
    expect(toTRPCError(notFound("Employment not found."))).toMatchObject({
      code: "NOT_FOUND",
      message: "Employment not found.",
    });
    expect(toTRPCError(conflict("Already exists."))).toMatchObject({
      code: "CONFLICT",
      message: "Already exists.",
    });
    const unexpected = toTRPCError(new Error("secret stack"));
    expect(unexpected).toBeInstanceOf(TRPCError);
    expect(unexpected.code).toBe("INTERNAL_SERVER_ERROR");
    expect(unexpected.message).toBe("Something went wrong.");
  });
});
