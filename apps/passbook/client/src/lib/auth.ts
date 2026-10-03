const STORAGE_KEY = "passbook.auth.token";

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { authorization: `Bearer ${token}` };
}

export function isRemoteHostUrl(hostUrl: string) {
  try {
    const { hostname } = new URL(hostUrl);
    return !(
      hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}
