import { createDataHandlers } from "@yourtoolshq/data/next";

import { dataPlatform } from "~/server/data";
import { fileRouter } from "~/server/files";

export const runtime = "nodejs";

export const { GET, POST } = createDataHandlers(dataPlatform, { fileRouter });
