import "~/styles/globals.css";

import { type Metadata } from "next";
import { Toaster } from "sonner";

import { ThemeProvider } from "@yourtoolshq/ui/theme-provider";
import { TooltipProvider } from "@yourtoolshq/ui/tooltip";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Roof",
  description:
    "A private record of your properties, tenancies, and the history under each roof.",
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
              <Toaster richColors closeButton />
            </TooltipProvider>
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
