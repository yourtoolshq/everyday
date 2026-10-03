import { Navigate } from "react-router-dom";

import { api } from "../trpc/react";

export function RequireHousehold({ children }: { children: React.ReactNode }) {
  const setup = api.setup.state.useQuery();
  if (setup.isLoading) return null;
  if (!setup.data?.initialized) return <Navigate to="/setup" replace />;
  return children;
}
