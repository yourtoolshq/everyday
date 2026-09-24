import { defineDataPlatform } from "@yourtoolshq/data";

import { env } from "~/env";
import * as schema from "~/server/db/schema";

export const dataPlatform = defineDataPlatform({
  app: "passbook",
  dataDir: env.DATA_DIR,
  db: { schema, migrationsFolder: "drizzle" },
});
