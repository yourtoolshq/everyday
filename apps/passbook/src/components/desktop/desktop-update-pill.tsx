"use client";

import { DownloadIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@yourtoolshq/ui/sidebar";
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
  getDesktopUpdateReleaseUrl,
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

  const visible =
    isPassbookDesktop() && state && shouldShowDesktopUpdateButton(state);
  if (!visible || !bridge || !state) return null;

  const action = resolveDesktopUpdateButtonAction(state);
  const disabled = isDesktopUpdateButtonDisabled(state) || isActionPending;
  const tooltip = getDesktopUpdateButtonTooltip(state);
  const releaseUrl = getDesktopUpdateReleaseUrl(
    state.downloadedVersion ?? state.availableVersion,
  );

  const handleClick = () => {
    if (disabled || action === "none") return;
    if (action === "download") {
      void handleDownload();
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton
                className="text-primary"
                disabled={disabled}
                onClick={handleClick}
              >
                {action === "install" ? (
                  <RotateCwIcon aria-hidden="true" />
                ) : (
                  <DownloadIcon aria-hidden="true" />
                )}
                <span>{getDesktopUpdateButtonLabel(state)}</span>
              </SidebarMenuButton>
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
        </SidebarMenuItem>
        {action === "download" ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-muted-foreground"
              onClick={() => void bridge.dismissUpdate()}
            >
              <XIcon aria-hidden="true" />
              <span>Dismiss until next launch</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
        {releaseUrl ? (
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href={releaseUrl} target="_blank" rel="noreferrer">
                <span>View release on GitHub</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>

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
