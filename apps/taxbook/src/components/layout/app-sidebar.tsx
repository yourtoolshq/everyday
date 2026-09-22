"use client";

import {
  IconBook2,
  IconFileDescription,
  IconFileCheck,
  IconLayoutDashboard,
  IconListDetails,
  IconReceiptDollar,
  IconCalculator,
  IconSettings,
  IconBriefcase,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
import { api } from "~/trpc/react";
import { YearSwitcher } from "./year-switcher";

const navigation = [
  { title: "Overview", href: "/", icon: IconLayoutDashboard },
  { title: "Tax Items", href: "/items", icon: IconListDetails },
  { title: "Paycheques", href: "/paycheques", icon: IconReceiptDollar },
  { title: "Self-employment", href: "/self-employment", icon: IconBriefcase },
  { title: "Tax Estimate", href: "/estimate", icon: IconCalculator },
  { title: "Tax Documents", href: "/documents", icon: IconFileDescription },
  { title: "Tax Filing", href: "/filing", icon: IconFileCheck },
  { title: "Settings", href: "/settings", icon: IconSettings },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const settings = api.settings.get.useQuery();
  const employments = api.employment.list.useQuery();
  const showPaychequesWorkspace = employments.data?.showPaychequesWorkspace ?? true;
  const visibleNavigation = navigation.filter(
    (item) => item.href !== "/paycheques" || showPaychequesWorkspace,
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-3 border-b p-3">
        <Link href="/" className="flex items-center gap-2 px-1.5 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <IconBook2 className="size-5" />
          </span>
          <span className="truncate">Tax Book</span>
        </Link>
        {settings.data ? <YearSwitcher years={settings.data.years} /> : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{settings.data?.household.name ?? "Household"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href} prefetch={item.href === "/estimate" ? false : undefined}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
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
