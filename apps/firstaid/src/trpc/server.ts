import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { createHydrationHelpers } from "@trpc/react-query/rsc";

import type { AppRouter } from "~/server/api/root";
import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { createQueryClient } from "./query-client";

const createContext = cache(async () => {
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("x-trpc-source", "rsc");
  return createTRPCContext({ headers: requestHeaders });
});

const getQueryClient = cache(createQueryClient);
const caller = createCaller(createContext);

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient,
);
