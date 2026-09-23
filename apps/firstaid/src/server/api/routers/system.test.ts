import { describe, expect, it } from "vitest";

import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

describe("system.status", () => {
  it("reports that the local database is reachable", async () => {
    const context = await createTRPCContext({ headers: new Headers() });
    const caller = createCaller(context);

    await expect(caller.system.status()).resolves.toEqual({ status: "ok" });
  });
});
