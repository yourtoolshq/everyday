"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  ClipboardCheck,
  DatabaseBackup,
  FileCheck,
  LayoutDashboard,
  Settings2,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar";

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const navigation = [
    { title: "Overview", href: "/", icon: LayoutDashboard },
    { title: "Employments", href: "/employments", icon: Briefcase },
    { title: "Pay review", href: "/review/pay-stubs", icon: ClipboardCheck },
    {
      title: "Record review",
      href: "/review/employment-records",
      icon: FileCheck,
    },
    { title: "Employers", href: "/employers", icon: Building2 },
    { title: "People", href: "/people", icon: Users },
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b p-3">
        <Link href="/" className="flex items-center gap-2 px-1.5 font-semibold">
          <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
            <Briefcase aria-hidden="true" className="size-5" />
          </span>
          <span className="truncate">Tenure</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Household</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavActive(pathname, item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/settings"}
                  tooltip="General"
                >
                  <Link href="/settings">
                    <Settings2 aria-hidden="true" />
                    <span>General</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isNavActive(pathname, "/settings/data")}
                  tooltip="Data & backups"
                >
                  <Link href="/settings/data">
                    <DatabaseBackup aria-hidden="true" />
                    <span>Data &amp; backups</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
