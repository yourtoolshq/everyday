import { defineDataPlatform } from "@yourtoolshq/data";

import { env } from "~/env";
import * as schema from "~/server/db/schema";

export const dataPlatform = defineDataPlatform({
  app: "passbook",
  version: env.APP_VERSION,
  dataDir: env.DATA_DIR,
  backupDir: env.BACKUP_DIR,
  db: { schema, migrationsFolder: "drizzle" },
});
