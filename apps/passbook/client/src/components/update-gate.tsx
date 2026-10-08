import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

import type { DesktopUpdateTrialState } from "~/lib/desktop-update.types";
import { useDesktopUpdate } from "~/hooks/use-desktop-update";
import { authHeaders } from "../lib/auth";
import { hostApiPath } from "../lib/host";

type VerifyState =
  | { kind: "loading" }
  | { kind: "maintenance"; status: PlatformStatus }
  | { kind: "ready" }
  | { kind: "error"; message: string };

async function readPlatformStatus() {
  const response = await fetch(hostApiPath("/api/data/status"), {
    cache: "no-store",
    headers: authHeaders(),
  });
  return (await response.json()) as PlatformStatus;
}

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const { bridge, state } = useDesktopUpdate();
  const trial = state?.trial ?? null;

  if (!trial) return children;

  if (trial.status === "failed") {
    return <FailedUpdateScreen trial={trial} bridge={bridge} />;
  }

  return (
    <VerifyUpdateScreen trial={trial} bridge={bridge}>
      {children}
    </VerifyUpdateScreen>
  );
}

function VerifyUpdateScreen({
  trial,
  bridge,
  children,
}: {
  trial: DesktopUpdateTrialState;
  bridge: ReturnType<typeof useDesktopUpdate>["bridge"];
  children: React.ReactNode;
}) {
  const [verifyState, setVerifyState] = useState<VerifyState>({
    kind: "loading",
  });
  const [committing, setCommitting] = useState(false);

  const verify = useCallback(async () => {
    setVerifyState({ kind: "loading" });
    try {
      const health = await fetch(hostApiPath("/api/health"), {
        cache: "no-store",
        headers: authHeaders(),
      });
      const body = (await health.json()) as {
        status?: string;
        state?: PlatformStatus | string;
      };

      if (
        body.status === "maintenance" ||
        !health.ok ||
        body.status === "error"
      ) {
        const status = await readPlatformStatus();
        if (status.state !== "ready") {
          setVerifyState({ kind: "maintenance", status });
          return;
        }
      }

      const status = await readPlatformStatus();
      if (status.state !== "ready") {
        setVerifyState({ kind: "maintenance", status });
        return;
      }

      if (status.version !== trial.targetVersion) {
        setVerifyState({
          kind: "error",
          message: `Expected version ${trial.targetVersion}, but the host reported ${status.version}.`,
        });
        return;
      }

      setVerifyState({ kind: "ready" });
    } catch {
      setVerifyState({
        kind: "error",
        message:
          "Passbook could not verify the updated host. Your pre-update backup is still available.",
      });
    }
  }, [trial.targetVersion]);

  useEffect(() => {
    void verify();
    const timer = setInterval(() => {
      void verify();
    }, 2000);
    return () => clearInterval(timer);
  }, [verify]);

  useEffect(() => {
    if (verifyState.kind !== "ready" || !bridge || committing) return;
    setCommitting(true);
    void bridge
      .commitTrial()
      .then((result) => {
        if (!result.completed) {
          setVerifyState({
            kind: "error",
            message:
              result.state.trial?.failureReason ??
              "Passbook could not finalize the update.",
          });
        }
      })
      .catch((error) => {
        setVerifyState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Passbook could not finalize the update.",
        });
      })
      .finally(() => {
        setCommitting(false);
      });
  }, [bridge, committing, verifyState.kind]);

  if (verifyState.kind === "maintenance") {
    return <MaintenanceScreen initialStatus={verifyState.status} />;
  }

  if (verifyState.kind === "error") {
    return (
      <FailedUpdateScreen
        trial={{
          ...trial,
          status: "failed",
          failureReason: verifyState.message,
        }}
        bridge={bridge}
      />
    );
  }

  if (committing || verifyState.kind !== "ready") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-lg shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LoaderCircle
                className="size-5 animate-spin"
                aria-hidden="true"
              />
              Verifying update
            </CardTitle>
            <CardDescription>
              Passbook {trial.targetVersion} is starting against your existing
              data. This screen clears once the update checkpoint succeeds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Backup checkpoint: <code>{trial.backupId || "pending"}</code>
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return children;
}

function FailedUpdateScreen({
  trial,
  bridge,
}: {
  trial: DesktopUpdateTrialState;
  bridge: ReturnType<typeof useDesktopUpdate>["bridge"];
}) {
  const navigate = useNavigate();
  const [dismissing, setDismissing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const completedBackup = Boolean(trial.backupId);

  const dismissFailure = async (destination?: string) => {
    if (!bridge) {
      setActionError(
        "Passbook could not clear the update recovery notice. Restart the desktop app and try again.",
      );
      return;
    }

    setDismissing(true);
    setActionError(null);
    try {
      const result = await bridge.dismissTrialFailure();
      if (!result.completed) {
        setActionError(
          "Passbook could not clear the update recovery notice. Restart the desktop app and try again.",
        );
        return;
      }
      if (destination) void navigate(destination);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Passbook could not clear the update recovery notice.",
      );
    } finally {
      setDismissing(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-lg shadow-none">
        <CardHeader>
          <div className="text-destructive flex items-center gap-2">
            <TriangleAlert className="size-5" aria-hidden="true" />
            <CardTitle>Update could not be verified</CardTitle>
          </div>
          <CardDescription>
            {trial.failureReason ??
              "The updated app did not start cleanly against your data."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {completedBackup ? (
              <>
                Passbook kept your pre-update backup (
                <code>{trial.backupId}</code>). You can review or restore it
                from Data &amp; backups before continuing.
              </>
            ) : (
              "No update was installed, and your existing Passbook data was left in place."
            )}
          </p>
          {actionError ? (
            <p className="text-destructive text-sm" role="alert">
              {actionError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={dismissing}
              onClick={() => void dismissFailure("/settings/data")}
            >
              Open Data &amp; backups
            </Button>
            <Button
              variant="outline"
              disabled={dismissing}
              onClick={() => void dismissFailure()}
            >
              Continue to Passbook
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
