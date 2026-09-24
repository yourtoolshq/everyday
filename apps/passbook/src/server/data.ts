import { defineDataPlatform } from "@yourtoolshq/data";

import { env } from "~/env";
import { db } from "~/server/db";

export const dataPlatform = defineDataPlatform({
  app: "passbook",
  dataDir: env.DATA_DIR,
  db,
});
