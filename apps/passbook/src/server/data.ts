import { defineDataPlatform } from "@yourtoolshq/data";

import { env } from "~/env";
import * as schema from "~/server/db/schema";

export const dataPlatform = defineDataPlatform({
  app: "passbook",
  version: env.APP_VERSION,
  dataDir: env.DATA_DIR,
  backupDir: env.BACKUP_DIR,
  db: { schema, migrationsFolder: "drizzle" },
  backups: {
    schedule: "daily@02:00",
    retention: { daily: 7, weekly: 4, monthly: 12 },
  },
});
