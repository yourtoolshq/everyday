"use client";

import { usePathname } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";

const titles: Record<string, string> = {
  "/": "Overview",
  "/employments": "Employments",
  "/employers": "Employers",
  "/people": "People",
};

export function SiteHeader() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Tenure";

  return (
    <header className="bg-background/85 flex h-(--header-height) shrink-0 items-center border-b backdrop-blur-sm">
      <div className="flex w-full items-center gap-2 px-4 md:px-6">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <h1 className="text-sm font-medium">{title}</h1>
        <span className="text-muted-foreground ml-auto hidden items-center gap-1.5 text-xs sm:flex">
          <LockKeyhole aria-hidden="true" className="size-3.5" />
          Private · Stored locally
        </span>
      </div>
    </header>
  );
}
