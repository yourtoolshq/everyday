import { z } from "zod";

const schema = z.object({
  APP_VERSION: z.string().min(1).optional(),
  BACKUP_DIR: z.string().min(1).optional(),
  DATA_DIR: z.string().min(1).default("./.data"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PASSBOOK_CLIENT_DIST: z.string().min(1).optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3847),
});

export type HostEnv = z.infer<typeof schema>;

export function loadHostEnv(
  source: Record<string, string | undefined> = process.env,
): HostEnv {
  return schema.parse({
    APP_VERSION: source.APP_VERSION,
    BACKUP_DIR: source.BACKUP_DIR,
    DATA_DIR: source.DATA_DIR,
    HOST: source.HOST,
    NODE_ENV: source.NODE_ENV,
    PASSBOOK_CLIENT_DIST: source.PASSBOOK_CLIENT_DIST,
    PORT: source.PORT,
  });
}

export function applyHostEnv(env: HostEnv) {
  process.env.APP_VERSION = env.APP_VERSION;
  process.env.BACKUP_DIR = env.BACKUP_DIR;
  process.env.DATA_DIR = env.DATA_DIR;
  process.env.NODE_ENV = env.NODE_ENV;
  if (env.PASSBOOK_CLIENT_DIST) {
    process.env.PASSBOOK_CLIENT_DIST = env.PASSBOOK_CLIENT_DIST;
  }
}
