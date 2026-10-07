import { type Config } from "drizzle-kit";

import { env } from "~/env";

export default {
  schema: "./shared/server/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${env.DATA_DIR}/passbook.db`,
  },
} satisfies Config;
