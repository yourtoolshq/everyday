"use client";

import {
  CalendarRange,
  FileText,
  HeartPulse,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar";

type FutureNavigationItem = {
  title: string;
  icon: LucideIcon;
};

const futureNavigation: FutureNavigationItem[] = [
  { title: "Care Plan", icon: CalendarRange },
  { title: "Visits", icon: Stethoscope },
  { title: "Documents", icon: FileText },
  { title: "Benefits", icon: ShieldCheck },
  { title: "Claims", icon: ReceiptText },
  { title: "Settings", icon: Settings },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b p-3">
        <Link
          href="/"
          className="flex items-center gap-2 px-1.5 font-semibold"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <HeartPulse aria-hidden="true" className="size-5" />
          </span>
          <span className="truncate">First Aid</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Healthcare year</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive
                  tooltip="Overview"
                >
                  <Link href="/">
                    <LayoutDashboard aria-hidden="true" />
                    <span>Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {futureNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    aria-disabled="true"
                    disabled
                    tooltip={`${item.title} — coming later`}
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>Later</SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

