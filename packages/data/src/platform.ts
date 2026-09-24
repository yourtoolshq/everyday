import { join } from "node:path";

import type { Database } from "./files/store";
import { createFileStore } from "./files/store";

export interface DataPlatformConfig {
  app: string;
  dataDir: string;
  db: Database;
}

export type DataPlatform = ReturnType<typeof defineDataPlatform>;

export function defineDataPlatform(config: DataPlatformConfig) {
  return {
    app: config.app,
    dataDir: config.dataDir,
    files: createFileStore({
      db: config.db,
      documentsDir: join(config.dataDir, "documents"),
    }),
  };
}
