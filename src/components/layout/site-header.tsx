"use client";

import { LockKeyhole } from "lucide-react";
import { usePathname } from "next/navigation";

import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";

const titles: Record<string, string> = {
  "/": "Overview",
  "/accounts": "Accounts",
  "/institutions": "Institutions",
  "/members": "Members",
  "/documents": "Documents",
};

export function SiteHeader() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Passbook";

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background/85 backdrop-blur-sm">
      <div className="flex w-full items-center gap-2 px-4 md:px-6">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <h1 className="text-sm font-medium">{title}</h1>
        <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <LockKeyhole aria-hidden="true" className="size-3.5" />
          Private · Stored locally
        </span>
      </div>
    </header>
  );
}
