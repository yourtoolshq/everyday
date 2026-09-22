import { z } from "zod";

export const discussionMetadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  discussionDate: z.string().trim().max(10).nullable().optional(),
  participants: z.string().trim().max(500).nullable().optional(),
  body: z.string().trim().max(50000).nullable().optional(),
});
