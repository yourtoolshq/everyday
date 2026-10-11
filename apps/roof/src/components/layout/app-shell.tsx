"use client";

import { BackupStatusBanner } from "@yourtoolshq/data-ui";
import { AppFrame } from "@yourtoolshq/ui/app-frame";

import { AppSidebar } from "~/components/layout/app-sidebar";
import { SiteHeader } from "~/components/layout/site-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppFrame
      sidebar={<AppSidebar variant="inset" />}
      header={<SiteHeader />}
      banners={<BackupStatusBanner />}
    >
      {children}
    </AppFrame>
  );
}
