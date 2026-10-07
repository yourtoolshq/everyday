import type { WebContents } from "electron";

export function isAllowedNavigation(target: string, allowedOrigins: string[]) {
  if (target.startsWith("file://") || target.startsWith("data:")) {
    return true;
  }

  try {
    const { origin } = new URL(target);
    return allowedOrigins.includes(origin);
  } catch {
    return false;
  }
}

export function isAllowedPreviewOpen(url: string, allowedOrigins: string[]) {
  return isAllowedNavigation(url, allowedOrigins);
}

export function attachNavigationGuard(
  webContents: WebContents,
  allowedOrigins: string[],
  openPreview: (url: string) => void,
) {
  webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url, allowedOrigins)) {
      event.preventDefault();
    }
  });

  webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedPreviewOpen(url, allowedOrigins)) {
      openPreview(url);
    }
    return { action: "deny" };
  });
}
