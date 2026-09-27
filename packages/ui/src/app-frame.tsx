"use client";

import type { CSSProperties, ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "./sidebar";

const frameStyle = {
  "--sidebar-width": "17rem",
  "--header-height": "3.5rem",
} as CSSProperties;

interface AppFrameProps {
  sidebar: ReactNode;
  header: ReactNode;
  banners?: ReactNode;
  children: ReactNode;
}

export function AppFrame({
  sidebar,
  header,
  banners,
  children,
}: AppFrameProps) {
  return (
    <SidebarProvider style={frameStyle}>
      {sidebar}
      <SidebarInset>
        {header}
        {banners}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
