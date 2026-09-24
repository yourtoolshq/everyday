import { createFileRouter, file } from "@yourtoolshq/data/files";

export const fileRouter = createFileRouter({
  document: file({ types: ["pdf", "image", "eml", "audio"], maxBytes: "25MB" }),
});

export type AppFileRouter = typeof fileRouter;
