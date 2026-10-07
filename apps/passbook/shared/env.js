import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    APP_VERSION: z.string().min(1).optional(),
    BACKUP_DIR: z.string().min(1).optional(),
    DATA_DIR: z.string().min(1).default("./.data"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {},
  runtimeEnv: {
    APP_VERSION: process.env.APP_VERSION,
    BACKUP_DIR: process.env.BACKUP_DIR,
    DATA_DIR: process.env.DATA_DIR,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
