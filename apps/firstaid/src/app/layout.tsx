import "~/styles/globals.css";

import { type Metadata } from "next";

import { ThemeProvider } from "@yourtoolshq/ui/theme-provider";
import { TooltipProvider } from "@yourtoolshq/ui/tooltip";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "First Aid",
  description: "A private, self-hosted healthcare year planner.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <TRPCReactProvider>
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
