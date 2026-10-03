import type { AuthContext } from "./types";

export function isLoopbackAddress(address: string) {
  if (!address) return true;
  const normalized = address.replace(/^::ffff:/, "");
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "localhost"
  );
}

export function readBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export function requiresRemoteAuth(context: AuthContext) {
  if (process.env.PASSBOOK_REQUIRE_AUTH === "1") return true;
  return !context.isLoopback;
}

export function isAuthAdminRoute(pathname: string) {
  return (
    pathname === "/api/auth/pairing-codes" ||
    pathname === "/api/auth/tokens" ||
    pathname.startsWith("/api/auth/tokens/")
  );
}

export function isPublicAuthRoute(pathname: string) {
  return pathname === "/api/auth/pair";
}

export function isHealthRoute(pathname: string) {
  return pathname === "/api/health";
}
