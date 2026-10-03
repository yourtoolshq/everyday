import { useEffect, useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import type { PlatformStatus } from "@yourtoolshq/data";
import { MaintenanceScreen } from "@yourtoolshq/data-ui/maintenance-screen";
import { Button } from "@yourtoolshq/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@yourtoolshq/ui/card";

import { getHostUrl, hostApiPath } from "../lib/host";

type GateState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "maintenance"; status: PlatformStatus }
  | { kind: "error"; message: string; hostUrl: string };

async function readPlatformStatus() {
  const response = await fetch(hostApiPath("/api/data/status"), {
    cache: "no-store",
  });
  return (await response.json()) as PlatformStatus;
}

export function HostGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: "loading" });
  const hostUrl = getHostUrl();

  const check = async () => {
    setState({ kind: "loading" });
    try {
      const health = await fetch(hostApiPath("/api/health"), {
        cache: "no-store",
      });
      const body = (await health.json()) as {
        status?: string;
        state?: PlatformStatus | string;
      };

      if (body.status === "maintenance") {
        const status = await readPlatformStatus();
        setState({ kind: "maintenance", status });
        return;
      }

      if (!health.ok || body.status === "error") {
        setState({
          kind: "error",
          hostUrl,
          message: "The Passbook host returned an error.",
        });
        return;
      }

      const status = await readPlatformStatus();
      if (status.state !== "ready") {
        setState({ kind: "maintenance", status });
        return;
      }

      setState({ kind: "ready" });
    } catch {
      setState({
        kind: "error",
        hostUrl,
        message:
          "Passbook could not reach the host. Start the host process and try again.",
      });
    }
  };

  useEffect(() => {
    void check();
  }, []);

  if (state.kind === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          Connecting to Passbook…
        </div>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-lg shadow-none">
          <CardHeader>
            <div className="text-destructive flex items-center gap-2">
              <TriangleAlert className="size-5" aria-hidden="true" />
              <CardTitle>Could not connect</CardTitle>
            </div>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Host URL: <code>{state.hostUrl}</code>
            </p>
            <Button onClick={() => void check()}>Retry</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (state.kind === "maintenance") {
    return <MaintenanceScreen initialStatus={state.status} />;
  }

  return children;
}
