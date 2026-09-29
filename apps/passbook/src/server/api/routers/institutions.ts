import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { fileToken } from "@yourtoolshq/data/files";

import { mapAppErrors } from "~/core/infrastructure/trpc-errors";
import { createInstitution } from "~/modules/institutions/application/create-institution";
import { listInstitutions } from "~/modules/institutions/application/list-institutions";
import { createInstitutionRepository } from "~/modules/institutions/infrastructure/institution-repository";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { institutions } from "~/server/db/schema";

const institutionInput = z.object({
  name: z.string().trim().min(1).max(160),
  website: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  icon: fileToken("institutionIcon").nullable().optional(),
});

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

function validateIcon(mimeType: string) {
  if (!["image/png", "image/webp"].includes(mimeType)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Upload a PNG or WebP icon.",
    });
  }
}

export const institutionsRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) =>
    mapAppErrors(() => listInstitutions(createInstitutionRepository(ctx.db))),
  ),

  get: publicProcedure.input(idInput).query(async ({ ctx, input }) => {
    const institution = await ctx.db.query.institutions.findFirst({
      where: eq(institutions.id, input.id),
    });
    if (!institution) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Institution not found.",
      });
    }
    return institution;
  }),

  create: publicProcedure.input(institutionInput).mutation(({ ctx, input }) =>
    mapAppErrors(() =>
      ctx.files.withFiles(ctx.db, async (tx, files) => {
        const icon = input.icon ? await files.claim(input.icon) : null;
        if (icon) validateIcon(icon.mimeType);
        return createInstitution(
          createInstitutionRepository(tx),
          { ...input, iconFileId: icon?.id ?? null },
        );
      }),
    ),
  ),

  update: publicProcedure
    .input(idInput.and(institutionInput))
    .mutation(({ ctx, input }) =>
      ctx.files.withFiles(ctx.db, async (tx, files) => {
        const [existing] = await tx
          .select({ iconFileId: institutions.iconFileId })
          .from(institutions)
          .where(eq(institutions.id, input.id));
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Institution not found.",
          });
        }
        const icon = input.icon ? await files.claim(input.icon) : null;
        if (icon) validateIcon(icon.mimeType);
        const iconFileId =
          input.icon === undefined ? existing.iconFileId : (icon?.id ?? null);
        const [institution] = await tx
          .update(institutions)
          .set({
            name: input.name,
            website: input.website ?? null,
            notes: input.notes ?? null,
            iconFileId,
            updatedAt: now(),
          })
          .where(eq(institutions.id, input.id))
          .returning();
        if (existing.iconFileId && existing.iconFileId !== iconFileId) {
          await files.remove(existing.iconFileId);
        }
        return institution;
      }),
    ),

  delete: publicProcedure.input(idInput).mutation(({ ctx, input }) =>
    ctx.files.withFiles(ctx.db, async (tx, files) => {
      const [institution] = await tx
        .delete(institutions)
        .where(eq(institutions.id, input.id))
        .returning({
          id: institutions.id,
          iconFileId: institutions.iconFileId,
        });
      if (!institution) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Institution not found.",
        });
      }
      if (institution.iconFileId) await files.remove(institution.iconFileId);
      return { id: institution.id };
    }),
  ),
});
