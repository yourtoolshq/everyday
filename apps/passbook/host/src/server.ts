import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createLogger } from "@yourtoolshq/server/log";

import type { HostEnv } from "./env";
import { applyHostEnv } from "./env";
import {
  closeHostServer,
  createHostHttpServer,
  listenHostServer,
} from "./http";

const passbookRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const logger = createLogger("passbook");

export interface PassbookHost {
  env: HostEnv;
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startPassbookHost(
  envInput: HostEnv,
): Promise<PassbookHost> {
  process.chdir(passbookRoot);
  applyHostEnv(envInput);

  const [{ dataPlatform }, { handleHostRequest }] = await Promise.all([
    import("~/server/data"),
    import("./router"),
  ]);

  try {
    await dataPlatform.boot();
    await dataPlatform.settled();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Passbook could not start.";
    logger.error("host.boot", {
      outcome: "failure",
      message,
      dataDir: envInput.DATA_DIR,
    });
    throw new Error(
      `Passbook host failed to initialize data at ${envInput.DATA_DIR}: ${message}`,
    );
  }

  const state = await dataPlatform.state();
  const server = createHostHttpServer({
    host: envInput.HOST,
    port: envInput.PORT,
    handler: handleHostRequest,
  });

  let port = envInput.PORT;
  try {
    const bound = await listenHostServer(server, {
      host: envInput.HOST,
      port: envInput.PORT,
    });
    port = bound.port;
  } catch (error) {
    dataPlatform.close();
    throw error;
  }

  const baseUrl = `http://${envInput.HOST}:${port}`;
  logger.info("host.start", {
    outcome: "success",
    port,
    host: envInput.HOST,
    dataDir: envInput.DATA_DIR,
    state: state.state,
    version: envInput.APP_VERSION ?? null,
  });

  return {
    env: { ...envInput, PORT: port },
    baseUrl,
    close: async () => {
      logger.info("host.shutdown", { outcome: "success", port });
      await closeHostServer(server);
      dataPlatform.close();
    },
  };
}
