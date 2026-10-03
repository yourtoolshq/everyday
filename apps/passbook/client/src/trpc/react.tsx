import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchStreamLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import SuperJSON from "superjson";

import type { AppRouter } from "~/server/api/root";
import { getHostUrl } from "../lib/host";
import { createQueryClient } from "./query-client";

export const api = createTRPCReact<AppRouter>();

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

const queryClient = createQueryClient();

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV !== "production" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${getHostUrl()}/api/trpc`,
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "passbook-client");
            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}
