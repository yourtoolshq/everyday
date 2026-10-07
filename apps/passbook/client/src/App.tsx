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
import { UpdateGate } from "./components/update-gate";
import { RequireHousehold } from "./components/require-household";
import { ActivityRoute } from "./routes/activity";
import { ActivityDetailRoute } from "./routes/activity-detail";
import { DocumentsRoute } from "./routes/documents";
import { FileViewerRoute } from "./routes/file-viewer";
import { InstitutionDetailRoute } from "./routes/institution-detail";
import { MembersRoute } from "./routes/members";
import { OverviewRoute } from "./routes/overview";
import { PairRoute } from "./routes/pair";
import { SettingsRoute } from "./routes/settings";
import { SettingsDataRoute } from "./routes/settings-data";
import { SetupRoute } from "./routes/setup";
import { TRPCReactProvider } from "./trpc/react";

function AppLayout() {
  return (
    <RequireHousehold>
      <AppShell>
        <Routes>
          <Route path="/" element={<OverviewRoute />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:accountId" element={<AccountDetailPage />} />
          <Route path="/institutions" element={<InstitutionsPage />} />
          <Route
            path="/institutions/:institutionId"
            element={<InstitutionDetailRoute />}
          />
          <Route path="/members" element={<MembersRoute />} />
          <Route path="/documents" element={<DocumentsRoute />} />
          <Route path="/activity" element={<ActivityRoute />} />
          <Route path="/activity/:eventId" element={<ActivityDetailRoute />} />
          <Route path="/settings" element={<SettingsRoute />} />
          <Route path="/settings/data" element={<SettingsDataRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </RequireHousehold>
  );
}

function AccountsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
      <AccountsWorkspace />
    </main>
  );
}

function AccountDetailPage() {
  const { accountId = "" } = useParams();
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
      <AccountDetailWorkspace accountId={accountId} />
    </main>
  );
}

function InstitutionsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
      <InstitutionsWorkspace />
    </main>
  );
}

export function App() {
  return (
    <TRPCReactProvider>
      <ThemeProvider>
        <TooltipProvider>
          <UpdateGate>
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
          </UpdateGate>
        </TooltipProvider>
      </ThemeProvider>
    </TRPCReactProvider>
  );
}
