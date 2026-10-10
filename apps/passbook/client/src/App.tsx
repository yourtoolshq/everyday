import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import { ThemeProvider } from "@yourtoolshq/ui/theme-provider";
import { TooltipProvider } from "@yourtoolshq/ui/tooltip";

import { AccountsWorkspace } from "~/components/accounts/accounts-workspace";
import { InstitutionsWorkspace } from "~/components/institutions/institutions-workspace";
import { AppShell } from "~/components/layout/app-shell";
import { Toaster } from "~/components/ui/sonner";
import { AuthGate } from "./components/auth-gate";
import { HostGate } from "./components/host-gate";
import { RequireHousehold } from "./components/require-household";
import { UpdateGate } from "./components/update-gate";
import { ActivityRoute } from "./routes/activity";
import { ActivityDetailRoute } from "./routes/activity-detail";
import { DocumentsRoute } from "./routes/documents";
import { FileViewerRoute } from "./routes/file-viewer";
import { HoldingsRoute } from "./routes/holdings";
import { InstitutionDetailRoute } from "./routes/institution-detail";
import { MembersRoute } from "./routes/members";
import { OverviewRoute } from "./routes/overview";
import { PairRoute } from "./routes/pair";
import { SettingsRoute } from "./routes/settings";
import { SettingsDataRoute } from "./routes/settings-data";
import { SetupRoute } from "./routes/setup";
import { TRPCReactProvider } from "./trpc/react";

const AccountDetailWorkspace = lazy(async () => ({
  default: (await import("~/components/accounts/account-detail-workspace"))
    .AccountDetailWorkspace,
}));
const HoldingDetailWorkspace = lazy(async () => ({
  default: (
    await import("~/components/investment-statements/holding-detail-workspace")
  ).HoldingDetailWorkspace,
}));
const InvestmentStatementRoute = lazy(async () => ({
  default: (await import("./routes/investment-statement"))
    .InvestmentStatementRoute,
}));

function AppLayout() {
  return (
    <RequireHousehold>
      <AppShell>
        <Suspense
          fallback={
            <p role="status" className="text-muted-foreground p-6 text-sm">
              Loading workspace…
            </p>
          }
        >
          <Routes>
            <Route path="/" element={<OverviewRoute />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route
              path="/accounts/:accountId"
              element={<AccountDetailPage />}
            />
            <Route path="/institutions" element={<InstitutionsPage />} />
            <Route
              path="/institutions/:institutionId"
              element={<InstitutionDetailRoute />}
            />
            <Route path="/members" element={<MembersRoute />} />
            <Route path="/documents" element={<DocumentsRoute />} />
            <Route
              path="/holdings/:instrumentId"
              element={<HoldingDetailPage />}
            />
            <Route path="/holdings" element={<HoldingsRoute />} />
            <Route
              path="/statements/:documentId/investments"
              element={<InvestmentStatementRoute />}
            />
            <Route path="/activity" element={<ActivityRoute />} />
            <Route
              path="/activity/:eventId"
              element={<ActivityDetailRoute />}
            />
            <Route path="/settings" element={<SettingsRoute />} />
            <Route path="/settings/data" element={<SettingsDataRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </RequireHousehold>
  );
}

function HoldingDetailPage() {
  const { instrumentId = "" } = useParams();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
      <HoldingDetailWorkspace key={instrumentId} instrumentId={instrumentId} />
    </main>
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
          <BrowserRouter>
            <UpdateGate>
              <HostGate>
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
              </HostGate>
            </UpdateGate>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </TRPCReactProvider>
  );
}
