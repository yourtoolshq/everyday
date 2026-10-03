import { describe, expect, it } from "vitest";

import { loadHostEnv } from "./env";

describe("loadHostEnv", () => {
  it("applies documented defaults", () => {
    expect(
      loadHostEnv({
        DATA_DIR: undefined,
        BACKUP_DIR: undefined,
        HOST: undefined,
        PORT: undefined,
        NODE_ENV: undefined,
      }),
    ).toEqual({
      DATA_DIR: "./.data",
      BACKUP_DIR: undefined,
      HOST: "127.0.0.1",
      PORT: 3847,
      NODE_ENV: "development",
      APP_VERSION: undefined,
    });
  });
});
