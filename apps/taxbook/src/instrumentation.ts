export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { dataPlatform } = await import("~/server/data");
  const { exportLegacyAttachments } = await import("~/server/legacy-files");
  await exportLegacyAttachments();
  await dataPlatform.boot();
}
