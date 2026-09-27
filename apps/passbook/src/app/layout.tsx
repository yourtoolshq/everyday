import "~/styles/globals.css";

import { type Metadata } from "next";

import { ThemeProvider } from "@yourtoolshq/ui/theme-provider";
import { TooltipProvider } from "@yourtoolshq/ui/tooltip";

import { Toaster } from "~/components/ui/sonner";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Passbook",
  description: "A private, self-hosted household financial account tracker.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <TRPCReactProvider>
          <ThemeProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
