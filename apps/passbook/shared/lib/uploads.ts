import { createUploadHelpers } from "@yourtoolshq/data-ui";

import type { AppFileRouter } from "~/server/files";

export const { FileDropzone, useUpload } = createUploadHelpers<AppFileRouter>();
