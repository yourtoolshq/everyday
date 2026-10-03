import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import { ThemeProvider } from "@yourtoolshq/ui/theme-provider";
import { TooltipProvider } from "@yourtoolshq/ui/tooltip";

import { AccountDetailWorkspace } from "~/components/accounts/account-detail-workspace";
import { AccountsWorkspace } from "~/components/accounts/accounts-workspace";
import { InstitutionsWorkspace } from "~/components/institutions/institutions-workspace";
import { AppShell } from "~/components/layout/app-shell";
import { Toaster } from "~/components/ui/sonner";
import { AuthGate } from "./components/auth-gate";
import { HostGate } from "./components/host-gate";
import { RequireHousehold } from "./components/require-household";
import { FileViewerRoute } from "./routes/file-viewer";
import { OverviewRoute } from "./routes/overview";
import { PairRoute } from "./routes/pair";
import { SetupRoute } from "./routes/setup";
import { TRPCReactProvider } from "./trpc/react";

function AppLayout() {
  return (
    <RequireHousehold>
      <AppShell>
        <Routes>
          <Route path="/" element={<OverviewRoute />} />
          <Route
            path="/accounts"
            element={
              <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
                <AccountsWorkspace />
              </main>
            }
          />
          <Route
            path="/accounts/:accountId"
            element={
              <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
                <AccountDetailRoute />
              </main>
            }
          />
          <Route
            path="/institutions"
            element={
              <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
                <InstitutionsWorkspace />
              </main>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </RequireHousehold>
  );
}

function AccountDetailRoute() {
  const { accountId = "" } = useParams();
  return <AccountDetailWorkspace accountId={accountId} />;
}

export function App() {
  return (
    <TRPCReactProvider>
      <ThemeProvider>
        <TooltipProvider>
          <HostGate>
            <BrowserRouter>
              <Routes>
                <Route path="/pair" element={<PairRoute />} />
                <Route
                  path="/setup"
                  element={
                    <AuthGate>
                      <SetupRoute />
                    </AuthGate>
                  }
                />
                <Route
                  path="/files/:fileId"
                  element={
                    <AuthGate>
                      <FileViewerRoute />
                    </AuthGate>
                  }
                />
                <Route
                  path="/*"
                  element={
                    <AuthGate>
                      <AppLayout />
                    </AuthGate>
                  }
                />
              </Routes>
              <Toaster />
            </BrowserRouter>
          </HostGate>
        </TooltipProvider>
      </ThemeProvider>
    </TRPCReactProvider>
  );
}
