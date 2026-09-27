import { type Config } from "drizzle-kit";

import { env } from "~/env";

export default {
  schema: "./src/server/db/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${env.DATA_DIR}/taxbook.db`,
  },
} satisfies Config;
