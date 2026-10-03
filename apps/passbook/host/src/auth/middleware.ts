import type { AuthStore } from "./store";
import type { AuthContext } from "./types";
import {
  isAuthAdminRoute,
  isHealthRoute,
  isPublicAuthRoute,
  isLoopbackAddress,
  readBearerToken,
  requiresRemoteAuth,
} from "./policy";

export interface HostRequestContext {
  request: Request;
  remoteAddress: string;
}

export async function authorizeRequest(
  store: AuthStore,
  input: HostRequestContext,
): Promise<{ context: AuthContext; error?: Response }> {
  const { request, remoteAddress } = input;
  const { pathname } = new URL(request.url);
  const isLoopback = isLoopbackAddress(remoteAddress);
  const bearer = readBearerToken(request);
  const tokenId = await store.verifyToken(bearer);

  const context: AuthContext = {
    remoteAddress,
    isLoopback,
    tokenId,
  };

  if (isPublicAuthRoute(pathname)) {
    return { context };
  }

  if (isAuthAdminRoute(pathname)) {
    if (!isLoopback) {
      return {
        context,
        error: Response.json(
          { error: "Token administration is only available on loopback." },
          { status: 403 },
        ),
      };
    }
    return { context };
  }

  if (isHealthRoute(pathname)) {
    return { context };
  }

  if (!requiresRemoteAuth(context)) {
    return { context };
  }

  if (!tokenId) {
    return {
      context,
      error: Response.json(
        { error: "Authentication required for remote access." },
        { status: 401 },
      ),
    };
  }

  return { context };
}
