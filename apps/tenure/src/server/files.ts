import { createFileRouter, file } from "@yourtoolshq/data/files";

export const fileRouter = createFileRouter({
  document: file({ types: ["pdf", "image", "eml"], maxBytes: "25MB" }),
  employerIcon: file({ types: ["image"], maxBytes: "1MB" }),
});

export type AppFileRouter = typeof fileRouter;
