import { Navigate } from "react-router-dom";

import { SetupForm } from "~/components/setup/setup-form";
import { api } from "../trpc/react";

export function SetupRoute() {
  const setup = api.setup.state.useQuery();
  if (setup.isLoading) return null;
  if (setup.data?.initialized) return <Navigate to="/" replace />;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <SetupForm />
    </main>
  );
}
