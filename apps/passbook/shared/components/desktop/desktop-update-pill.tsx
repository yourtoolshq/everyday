"use client";

import { useCallback, useState } from "react";
import { DownloadIcon, RefreshCwIcon, RotateCwIcon } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@yourtoolshq/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@yourtoolshq/ui/tooltip";

import { useDesktopUpdate } from "~/hooks/use-desktop-update";
import {
  getDesktopUpdateActionError,
  getDesktopUpdateButtonLabel,
  getDesktopUpdateButtonTooltip,
  getDesktopUpdateInstallConfirmationMessage,
  isDesktopUpdateButtonDisabled,
  isPassbookDesktop,
  resolveDesktopUpdateButtonAction,
  shouldShowDesktopUpdateButton,
} from "~/lib/desktop-update.logic";

function ReleaseNotesTooltip({
  tooltip,
  releaseNotes,
}: {
  tooltip: string;
  releaseNotes: Array<{ version: string; items: string[] }>;
}) {
  if (releaseNotes.length === 0) {
    return tooltip;
  }

  return (
    <div className="space-y-3 text-left">
      <p>{tooltip}</p>
      {releaseNotes.map((releaseNote) => (
        <div key={releaseNote.version} className="space-y-1">
          <p className="font-medium">
            What&apos;s changed in {releaseNote.version}
          </p>
          <ul className="list-disc space-y-1 pl-4">
            {releaseNote.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DesktopUpdatePill() {
  const { bridge, state } = useDesktopUpdate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  const handleCheck = useCallback(async () => {
    if (!bridge) return;
    setIsActionPending(true);
    try {
      const result = await bridge.checkForUpdates();
      const error = getDesktopUpdateActionError(result);
      if (error) {
        toast.error("Could not check for updates", { description: error });
      }
    } catch (error) {
      toast.error("Could not check for updates", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
    } finally {
      setIsActionPending(false);
    }
  }, [bridge]);

  const handleDownload = useCallback(async () => {
    if (!bridge) return;
    setIsActionPending(true);
    try {
      const result = await bridge.downloadUpdate();
      const error = getDesktopUpdateActionError(result);
      if (error) {
        toast.error("Could not download update", { description: error });
      }
    } catch (error) {
      toast.error("Could not start update download", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
    } finally {
      setIsActionPending(false);
    }
  }, [bridge]);

  const handleInstall = useCallback(async () => {
    if (!bridge) return;
    setIsActionPending(true);
    try {
      const result = await bridge.installUpdate();
      const error = getDesktopUpdateActionError(result);
      if (error) {
        toast.error("Could not install update", { description: error });
      }
    } catch (error) {
      toast.error("Could not install update", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
    } finally {
      setIsActionPending(false);
      setConfirmOpen(false);
    }
  }, [bridge]);

  const isDesktop = isPassbookDesktop();
  if (!isDesktop || !bridge || !state) return null;

  const visible = shouldShowDesktopUpdateButton(state);
  if (!visible) return null;

  const action = resolveDesktopUpdateButtonAction(state);
  const disabled = isDesktopUpdateButtonDisabled(state) || isActionPending;
  const tooltip = getDesktopUpdateButtonTooltip(state);
  const handleClick = () => {
    if (disabled || action === "none") return;
    if (action === "check") {
      void handleCheck();
      return;
    }
    if (action === "download") {
      void handleDownload();
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-muted-foreground truncate text-xs">
          v{state.currentVersion}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={getDesktopUpdateButtonLabel(state)}
              disabled={disabled}
              onClick={handleClick}
              className={`relative flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-wait disabled:opacity-70 ${
                action === "download" || action === "install"
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {state.status === "downloading" ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(currentColor ${Math.min(
                      100,
                      Math.max(0, state.downloadPercent ?? 0),
                    )}%, transparent 0)`,
                  }}
                />
              ) : null}
              <span className="bg-background relative flex size-7 items-center justify-center rounded-full">
                {action === "install" ? (
                  <RotateCwIcon aria-hidden="true" className="size-4" />
                ) : action === "download" || state.status === "downloading" ? (
                  <DownloadIcon aria-hidden="true" className="size-4" />
                ) : (
                  <RefreshCwIcon
                    aria-hidden="true"
                    className={`size-4 ${
                      state.status === "checking" ? "animate-spin" : ""
                    }`}
                  />
                )}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className={
              state.releaseNotes.length > 0
                ? "pointer-events-auto max-w-sm"
                : undefined
            }
          >
            <ReleaseNotesTooltip
              tooltip={tooltip}
              releaseNotes={state.releaseNotes}
            />
          </TooltipContent>
        </Tooltip>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Install update and restart?</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {getDesktopUpdateInstallConfirmationMessage(state)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isActionPending}
              onClick={(event) => {
                event.preventDefault();
                void handleInstall();
              }}
            >
              Install and restart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
