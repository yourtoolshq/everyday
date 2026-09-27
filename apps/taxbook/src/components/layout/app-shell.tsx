"use client";

import { BackupStatusBanner } from "@yourtoolshq/data-ui";
import { AppFrame } from "@yourtoolshq/ui/app-frame";

import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";
import { TenureConnectionBanner } from "./tenure-connection-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppFrame
      sidebar={<AppSidebar variant="inset" />}
      header={<SiteHeader />}
      banners={
        <>
          <BackupStatusBanner />
          <TenureConnectionBanner />
        </>
      }
    >
      <main className="flex flex-1 flex-col">{children}</main>
    </AppFrame>
  );
}
