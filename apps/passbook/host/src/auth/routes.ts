import type { AuthStore } from "./store";
import type { AuthContext } from "./types";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function handleAuthRoute(
  store: AuthStore,
  request: Request,
  _context: AuthContext,
) {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/auth/pairing-codes" && request.method === "POST") {
    const record = await store.createPairingCode();
    return json({
      code: record.code,
      expiresAt: record.expiresAt,
    });
  }

  if (pathname === "/api/auth/pair" && request.method === "POST") {
    const body = (await request.json()) as {
      code?: string;
      label?: string;
    };
    if (!body.code) {
      return json({ error: "Pairing code is required." }, 400);
    }
    try {
      const paired = await store.pairDevice({
        code: body.code,
        label: body.label ?? "Paired device",
      });
      return json(paired, 201);
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error ? error.message : "Pairing failed.",
        },
        400,
      );
    }
  }

  if (pathname === "/api/auth/tokens" && request.method === "GET") {
    const tokens = await store.listTokens();
    return json({ tokens });
  }

  if (pathname.startsWith("/api/auth/tokens/") && request.method === "DELETE") {
    const id = pathname.slice("/api/auth/tokens/".length);
    try {
      await store.revokeToken(id);
      return new Response(null, { status: 204 });
    } catch {
      return json({ error: "Token not found." }, 404);
    }
  }

  return json({ error: "Not found." }, 404);
}
