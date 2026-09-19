import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { employmentStatuses } from "~/lib/employment-status";
import { payFrequencies } from "~/lib/pay-frequency";
import {
  normalizeDeductionSettings,
  parseDeductionSettings,
  serializeDeductionSettings,
  type DeductionSettings,
} from "~/lib/paycheck-deductions";
import { employers, employments, people } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const deductionSettingsInput = z.object({
  incomeTaxEnabled: z.boolean(),
  federalIncomeTaxEnabled: z.boolean(),
  manitobaIncomeTaxEnabled: z.boolean(),
  cppEnabled: z.boolean(),
  cpp2Enabled: z.boolean(),
  eiEnabled: z.boolean(),
  wiEnabled: z.boolean(),
  ltdEnabled: z.boolean(),
  extendedHealthEnabled: z.boolean(),
  travelMedicalEnabled: z.boolean(),
  unionDuesEnabled: z.boolean(),
  otherDeductionsEnabled: z.boolean(),
  deductionFieldOrder: z.array(z.string()).nullable(),
});

const employmentInput = z.object({
  employerId: z.string().uuid(),
  personId: z.string().uuid(),
  jobTitle: z.string().trim().max(160).nullable().optional(),
  status: z.enum(employmentStatuses).default("current"),
  startDate: z.string().trim().max(10).nullable().optional(),
  endDate: z.string().trim().max(10).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  payFrequency: z.enum(payFrequencies).default("irregular"),
  biweeklyAnchorDate: z.string().trim().max(10).nullable().optional(),
});

const paySettingsInput = z.object({
  employmentId: z.string().uuid(),
  payFrequency: z.enum(payFrequencies),
  biweeklyAnchorDate: z.string().trim().max(10).nullable().optional(),
  deductionSettings: deductionSettingsInput,
});

function mapEmploymentRow(
  row: {
    id: string;
    employerId: string;
    employerName: string;
    personId: string;
    personName: string;
    jobTitle: string | null;
    status: (typeof employmentStatuses)[number];
    startDate: string | null;
    endDate: string | null;
    notes: string | null;
    payFrequency: (typeof payFrequencies)[number];
    biweeklyAnchorDate: string | null;
    deductionSettings: string;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
    ...row,
    deductionSettings: parseDeductionSettings(row.deductionSettings),
  };
}

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

export const employmentsRouter = createTRPCRouter({
  getById: publicProcedure.input(idInput).query(async ({ ctx, input }) => {
    const [employment] = await ctx.db
      .select({
        id: employments.id,
        employerId: employers.id,
        employerName: employers.name,
        personId: people.id,
        personName: people.displayName,
        jobTitle: employments.jobTitle,
        status: employments.status,
        startDate: employments.startDate,
        endDate: employments.endDate,
        notes: employments.notes,
        payFrequency: employments.payFrequency,
        biweeklyAnchorDate: employments.biweeklyAnchorDate,
        deductionSettings: employments.deductionSettings,
        createdAt: employments.createdAt,
        updatedAt: employments.updatedAt,
      })
      .from(employments)
      .innerJoin(employers, eq(employments.employerId, employers.id))
      .innerJoin(people, eq(employments.personId, people.id))
      .where(eq(employments.id, input.id));
    if (!employment) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
    }
    return mapEmploymentRow(employment);
  }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: employments.id,
        employerId: employers.id,
        employerName: employers.name,
        personId: people.id,
        personName: people.displayName,
        jobTitle: employments.jobTitle,
        status: employments.status,
        startDate: employments.startDate,
        endDate: employments.endDate,
        notes: employments.notes,
        payFrequency: employments.payFrequency,
        biweeklyAnchorDate: employments.biweeklyAnchorDate,
        deductionSettings: employments.deductionSettings,
        createdAt: employments.createdAt,
        updatedAt: employments.updatedAt,
      })
      .from(employments)
      .innerJoin(employers, eq(employments.employerId, employers.id))
      .innerJoin(people, eq(employments.personId, people.id))
      .orderBy(asc(employers.name), asc(people.displayName))
      .then((rows) => rows.map(mapEmploymentRow));
  }),

  create: publicProcedure.input(employmentInput).mutation(async ({ ctx, input }) => {
    const [employer] = await ctx.db
      .select({ id: employers.id })
      .from(employers)
      .where(eq(employers.id, input.employerId));
    if (!employer) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employer not found." });
    }

    const person = await ctx.db.query.people.findFirst({
      where: eq(people.id, input.personId),
    });
    if (!person) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid person." });
    }

    const [employment] = await ctx.db
      .insert(employments)
      .values({
        employerId: input.employerId,
        personId: input.personId,
        jobTitle: input.jobTitle ?? null,
        status: input.status,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        notes: input.notes ?? null,
        payFrequency: input.payFrequency,
        biweeklyAnchorDate: input.biweeklyAnchorDate ?? null,
      })
      .returning();
    if (!employment) throw new Error("Employment creation failed.");
    return {
      ...employment,
      deductionSettings: parseDeductionSettings(employment.deductionSettings),
    };
  }),

  update: publicProcedure
    .input(idInput.and(employmentInput))
    .mutation(async ({ ctx, input }) => {
      const person = await ctx.db.query.people.findFirst({
        where: eq(people.id, input.personId),
      });
      if (!person) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid person." });
      }

      const [employment] = await ctx.db
        .update(employments)
        .set({
          employerId: input.employerId,
          personId: input.personId,
          jobTitle: input.jobTitle ?? null,
          status: input.status,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          notes: input.notes ?? null,
          payFrequency: input.payFrequency,
          biweeklyAnchorDate: input.biweeklyAnchorDate ?? null,
          updatedAt: now(),
        })
        .where(eq(employments.id, input.id))
        .returning();
      if (!employment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
      }
      return {
        ...employment,
        deductionSettings: parseDeductionSettings(employment.deductionSettings),
      };
    }),

  updatePaySettings: publicProcedure.input(paySettingsInput).mutation(async ({ ctx, input }) => {
    const settings = normalizeDeductionSettings(
      input.deductionSettings as DeductionSettings,
    );

    const [employment] = await ctx.db
      .update(employments)
      .set({
        payFrequency: input.payFrequency,
        biweeklyAnchorDate: input.biweeklyAnchorDate ?? null,
        deductionSettings: serializeDeductionSettings(settings),
        updatedAt: now(),
      })
      .where(eq(employments.id, input.employmentId))
      .returning();
    if (!employment) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
    }
    return {
      ...employment,
      deductionSettings: parseDeductionSettings(employment.deductionSettings),
    };
  }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [employment] = await ctx.db
      .delete(employments)
      .where(eq(employments.id, input.id))
      .returning({ id: employments.id });
    if (!employment) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
    }
    return employment;
  }),
});
