import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { fileToken } from "@yourtoolshq/data/files";

import { countryCodes } from "~/lib/countries";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { employers, employments, people } from "~/server/db/schema";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const employerInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    website: optionalText(500),
    email: z.string().trim().email().max(254).nullable().optional(),
    phone: optionalText(50),
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(120),
    region: optionalText(120),
    postalCode: optionalText(40),
    countryCode: z.enum(countryCodes).nullable().optional(),
    notes: optionalText(2000),
    icon: fileToken("employerIcon").nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (
      (input.addressLine1 ||
        input.addressLine2 ||
        input.city ||
        input.region ||
        input.postalCode) &&
      !input.countryCode
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["countryCode"],
        message: "Choose a country when entering an address.",
      });
    }
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

export const employersRouter = createTRPCRouter({
  getById: publicProcedure.input(idInput).query(async ({ ctx, input }) => {
    const [employer] = await ctx.db
      .select()
      .from(employers)
      .where(eq(employers.id, input.id));
    if (!employer) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employer not found.",
      });
    }

    const relatedEmployments = await ctx.db
      .select({
        id: employments.id,
        personId: people.id,
        personName: people.displayName,
        jobTitle: employments.jobTitle,
        status: employments.status,
        startDate: employments.startDate,
        endDate: employments.endDate,
      })
      .from(employments)
      .innerJoin(people, eq(employments.personId, people.id))
      .where(eq(employments.employerId, input.id))
      .orderBy(asc(employments.status), asc(employments.startDate));

    return { ...employer, employments: relatedEmployments };
  }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.employers.findMany({
      orderBy: [asc(employers.name)],
    });
  }),

  create: publicProcedure.input(employerInput).mutation(({ ctx, input }) =>
    ctx.files.withFiles(ctx.db, async (tx, files) => {
      const icon = input.icon ? await files.claim(input.icon) : null;
      if (icon) validateIcon(icon.mimeType);
      const [employer] = await tx
        .insert(employers)
        .values({
          name: input.name,
          website: input.website ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          addressLine1: input.addressLine1 ?? null,
          addressLine2: input.addressLine2 ?? null,
          city: input.city ?? null,
          region: input.region ?? null,
          postalCode: input.postalCode ?? null,
          countryCode: input.countryCode ?? null,
          iconFileId: icon?.id ?? null,
          notes: input.notes ?? null,
        })
        .returning();
      return employer;
    }),
  ),

  update: publicProcedure
    .input(employerInput.and(idInput))
    .mutation(({ ctx, input }) =>
      ctx.files.withFiles(ctx.db, async (tx, files) => {
        const [existing] = await tx
          .select({ iconFileId: employers.iconFileId })
          .from(employers)
          .where(eq(employers.id, input.id));
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Employer not found.",
          });
        }
        const icon = input.icon ? await files.claim(input.icon) : null;
        if (icon) validateIcon(icon.mimeType);
        const iconFileId =
          input.icon === undefined ? existing.iconFileId : (icon?.id ?? null);
        const [employer] = await tx
          .update(employers)
          .set({
            name: input.name,
            website: input.website ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            addressLine1: input.addressLine1 ?? null,
            addressLine2: input.addressLine2 ?? null,
            city: input.city ?? null,
            region: input.region ?? null,
            postalCode: input.postalCode ?? null,
            countryCode: input.countryCode ?? null,
            iconFileId,
            notes: input.notes ?? null,
            updatedAt: now(),
          })
          .where(eq(employers.id, input.id))
          .returning();
        if (existing.iconFileId && existing.iconFileId !== iconFileId) {
          await files.remove(existing.iconFileId);
        }
        return employer;
      }),
    ),

  delete: publicProcedure.input(idInput).mutation(({ ctx, input }) =>
    ctx.files.withFiles(ctx.db, async (tx, files) => {
      const [employer] = await tx
        .delete(employers)
        .where(eq(employers.id, input.id))
        .returning({ id: employers.id, iconFileId: employers.iconFileId });
      if (!employer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Employer not found.",
        });
      }
      if (employer.iconFileId) await files.remove(employer.iconFileId);
      return { id: employer.id };
    }),
  ),
});
