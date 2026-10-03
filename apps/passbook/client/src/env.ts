import { z } from "zod";

const schema = z.object({
  VITE_PASSBOOK_HOST_URL: z.string().url().default("http://127.0.0.1:3847"),
  VITE_PASSBOOK_ALLOW_REMOTE: z.enum(["0", "1"]).optional(),
});

export const clientEnv = schema.parse({
  VITE_PASSBOOK_HOST_URL: import.meta.env.VITE_PASSBOOK_HOST_URL,
  VITE_PASSBOOK_ALLOW_REMOTE: import.meta.env.VITE_PASSBOOK_ALLOW_REMOTE,
});
