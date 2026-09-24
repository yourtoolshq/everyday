export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { dataPlatform } = await import("~/server/data");
  await dataPlatform.boot();
}
