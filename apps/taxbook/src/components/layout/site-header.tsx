"use client";

import { usePathname } from "next/navigation";

import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";

const titles: Record<string, string> = {
  "/": "Overview",
  "/items": "Tax Items",
  "/paycheques": "Paycheques",
  "/documents": "Tax Documents",
  "/settings": "Settings",
};

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="bg-background/85 flex h-(--header-height) shrink-0 items-center border-b backdrop-blur">
      <div className="flex w-full items-center gap-2 px-6">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <h1 className="text-sm font-medium">
          {pathname.startsWith("/items/")
            ? "Tax Item Details"
            : (titles[pathname] ?? "Tax Book")}
        </h1>
        <span className="text-muted-foreground ml-auto text-xs">
          Private · Stored locally
        </span>
      </div>
    </header>
  );
}
