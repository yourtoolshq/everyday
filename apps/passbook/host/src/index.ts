import { createLogger } from "@yourtoolshq/server/log";

import { applyHostEnv, loadHostEnv } from "./env";

const logger = createLogger("passbook");

async function main() {
  const env = loadHostEnv();
  applyHostEnv(env);
  const { startPassbookHost } = await import("./server");
  const host = await startPassbookHost(env);

  const shutdown = async (signal: string) => {
    logger.info("host.signal", { signal });
    try {
      await host.close();
      process.exit(0);
    } catch (error) {
      logger.error("host.shutdown", {
        outcome: "failure",
        message: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  console.info(
    `Passbook host listening on ${host.baseUrl} (DATA_DIR=${env.DATA_DIR})`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("host.start", { outcome: "failure", message });
  console.error(message);
  process.exit(1);
});
