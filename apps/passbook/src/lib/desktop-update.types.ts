export type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error";

export interface DesktopUpdateReleaseNote {
  version: string;
  items: string[];
}

export interface DesktopUpdateTrialState {
  targetVersion: string;
  previousVersion: string;
  backupId: string;
  status: "verifying" | "failed";
  failureReason?: string;
}

export interface DesktopUpdateState {
  enabled: boolean;
  status: DesktopUpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  releaseNotes: DesktopUpdateReleaseNote[];
  downloadPercent: number | null;
  message: string | null;
  errorContext: "check" | "download" | "install" | null;
  dismissed: boolean;
  trial: DesktopUpdateTrialState | null;
}

export interface DesktopUpdateActionResult {
  accepted: boolean;
  completed: boolean;
  state: DesktopUpdateState;
}

export interface PassbookDesktopUpdatesBridge {
  getState: () => Promise<DesktopUpdateState>;
  subscribe: (listener: (state: DesktopUpdateState) => void) => () => void;
  downloadUpdate: () => Promise<DesktopUpdateActionResult>;
  installUpdate: () => Promise<DesktopUpdateActionResult>;
  dismissUpdate: () => Promise<DesktopUpdateState>;
  commitTrial: () => Promise<DesktopUpdateActionResult>;
  markTrialFailed: (reason: string) => Promise<DesktopUpdateActionResult>;
}

export interface PassbookDesktopBridge {
  hostUrl: string;
  updates?: PassbookDesktopUpdatesBridge;
}

declare global {
  interface Window {
    passbookDesktop?: PassbookDesktopBridge;
  }
}
