import { initTRPC, TRPCError } from "@trpc/server";

import type { DataPlatform, PlatformState } from "./platform";

const t = initTRPC.create();

export function describeUnavailable(app: string, state: PlatformState) {
  switch (state.state) {
    case "ready":
      return null;
    case "upgrading":
      return `${app} is upgrading its data; try again when it is done`;
    case "restoring":
      return `${app} is restoring a backup; try again when it is done`;
    case "blocked":
      return state.message;
  }
}

// For the application's base procedure: no procedure reads or writes the database
// while the platform is not ready.
export function requireReady(platform: Pick<DataPlatform, "app" | "state">) {
  return t.middleware(async ({ next }) => {
    const unavailable = describeUnavailable(
      platform.app,
      await platform.state(),
    );
    if (unavailable) {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: unavailable,
      });
    }
    return next();
  });
}
