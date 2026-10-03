declare const __PASSBOOK_HOST_URL__: string;

interface PassbookDesktopBridge {
  hostUrl: string;
}

declare global {
  interface Window {
    passbookDesktop?: PassbookDesktopBridge;
  }
}

function readDesktopHostUrl() {
  if (typeof window === "undefined") return undefined;
  return window.passbookDesktop?.hostUrl;
}

export function getHostUrl() {
  const configured =
    readDesktopHostUrl() ??
    import.meta.env.VITE_PASSBOOK_HOST_URL ??
    __PASSBOOK_HOST_URL__;
  if (!configured) return "http://127.0.0.1:3847";

  const allowRemote = import.meta.env.VITE_PASSBOOK_ALLOW_REMOTE === "1";
  const { hostname } = new URL(configured);
  const loopback =
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "[::1]";
  if (!loopback && !allowRemote) {
    throw new Error(
      "Passbook only connects to loopback hosts unless PASSBOOK_ALLOW_REMOTE=1 is set.",
    );
  }
  return configured.replace(/\/$/, "");
}

export function hostApiPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV) return normalized;
  return `${getHostUrl()}${normalized}`;
}
