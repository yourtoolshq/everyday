import { createFileRouter, file } from "@yourtoolshq/data/files";

export const fileRouter = createFileRouter({
  document: file({ types: ["pdf", "image"], maxBytes: "25MB" }),
});

export type AppFileRouter = typeof fileRouter;
