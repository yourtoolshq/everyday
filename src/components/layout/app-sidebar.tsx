"use client";

import {
  Building2,
  CalendarRange,
  FileText,
  HeartPulse,
  ReceiptText,
  Settings,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
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
  { title: "Benefits", icon: ShieldCheck },
  { title: "Claims", icon: ReceiptText },
  { title: "Settings", icon: Settings },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const navigation = [
    { title: "Care Plan", href: "/", icon: CalendarRange },
    { title: "Visits", href: "/visits", icon: Stethoscope },
    { title: "Care Providers", href: "/care-providers", icon: Building2 },
    { title: "Documents", href: "/documents", icon: FileText },
  ];

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
              {navigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
