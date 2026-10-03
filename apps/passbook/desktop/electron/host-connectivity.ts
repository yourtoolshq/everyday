export async function isHostHealthy(baseUrl: string, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = (await response.json()) as { status?: string };
      if (
        response.ok &&
        (body.status === "ok" || body.status === "maintenance")
      ) {
        return true;
      }
    } catch {
      // Host is still booting or unreachable.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}
