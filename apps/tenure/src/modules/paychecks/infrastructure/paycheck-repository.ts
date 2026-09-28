import { desc, eq } from "drizzle-orm";

import { notFound, unexpected } from "@yourtoolshq/server/errors";

import type { DeductionSettings } from "~/lib/paycheck-deductions";
import type { PaycheckWriteValues } from "~/modules/paychecks/domain/paycheck-values";
import type { db as tenureDb } from "~/server/db";
import { parseDeductionSettings } from "~/lib/paycheck-deductions";
import { documents, employments, paychecks } from "~/server/db/schema";

export type TenureDatabase = typeof tenureDb;

export type PaycheckListItem = {
  id: string;
  employmentId: string;
  payDate: string;
  periodStartDate: string;
  periodEndDate: string;
  grossPayCents: number;
  incomeTaxCents: number;
  federalIncomeTaxCents: number;
  manitobaIncomeTaxCents: number;
  cppCents: number;
  cpp2Cents: number;
  eiCents: number;
  wiCents: number;
  ltdCents: number;
  extendedHealthCents: number;
  travelMedicalCents: number;
  unionDuesCents: number;
  otherDeductionsCents: number;
  netPayCents: number;
  documentId: string | null;
  documentTitle: string | null;
  documentFilename: string | null;
  documentFileId: string | null;
  documentMimeType: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaycheckRecord = {
  id: string;
  employmentId: string;
  payDate: string;
  periodStartDate: string;
  periodEndDate: string;
  grossPayCents: number;
  incomeTaxCents: number;
  federalIncomeTaxCents: number;
  manitobaIncomeTaxCents: number;
  cppCents: number;
  cpp2Cents: number;
  eiCents: number;
  wiCents: number;
  ltdCents: number;
  extendedHealthCents: number;
  travelMedicalCents: number;
  unionDuesCents: number;
  otherDeductionsCents: number;
  netPayCents: number;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
};

const paycheckListColumns = {
  id: paychecks.id,
  employmentId: paychecks.employmentId,
  payDate: paychecks.payDate,
  periodStartDate: paychecks.periodStartDate,
  periodEndDate: paychecks.periodEndDate,
  grossPayCents: paychecks.grossPayCents,
  incomeTaxCents: paychecks.incomeTaxCents,
  federalIncomeTaxCents: paychecks.federalIncomeTaxCents,
  manitobaIncomeTaxCents: paychecks.manitobaIncomeTaxCents,
  cppCents: paychecks.cppCents,
  cpp2Cents: paychecks.cpp2Cents,
  eiCents: paychecks.eiCents,
  wiCents: paychecks.wiCents,
  ltdCents: paychecks.ltdCents,
  extendedHealthCents: paychecks.extendedHealthCents,
  travelMedicalCents: paychecks.travelMedicalCents,
  unionDuesCents: paychecks.unionDuesCents,
  otherDeductionsCents: paychecks.otherDeductionsCents,
  netPayCents: paychecks.netPayCents,
  documentId: paychecks.documentId,
  documentTitle: documents.title,
  documentFilename: documents.originalFilename,
  documentFileId: documents.fileId,
  documentMimeType: documents.mimeType,
  createdAt: paychecks.createdAt,
  updatedAt: paychecks.updatedAt,
} as const;

const paycheckRecordColumns = {
  id: paychecks.id,
  employmentId: paychecks.employmentId,
  payDate: paychecks.payDate,
  periodStartDate: paychecks.periodStartDate,
  periodEndDate: paychecks.periodEndDate,
  grossPayCents: paychecks.grossPayCents,
  incomeTaxCents: paychecks.incomeTaxCents,
  federalIncomeTaxCents: paychecks.federalIncomeTaxCents,
  manitobaIncomeTaxCents: paychecks.manitobaIncomeTaxCents,
  cppCents: paychecks.cppCents,
  cpp2Cents: paychecks.cpp2Cents,
  eiCents: paychecks.eiCents,
  wiCents: paychecks.wiCents,
  ltdCents: paychecks.ltdCents,
  extendedHealthCents: paychecks.extendedHealthCents,
  travelMedicalCents: paychecks.travelMedicalCents,
  unionDuesCents: paychecks.unionDuesCents,
  otherDeductionsCents: paychecks.otherDeductionsCents,
  netPayCents: paychecks.netPayCents,
  documentId: paychecks.documentId,
  createdAt: paychecks.createdAt,
  updatedAt: paychecks.updatedAt,
} as const;

export function createPaycheckRepository(db: TenureDatabase) {
  return {
    async listByEmployment(employmentId: string): Promise<PaycheckListItem[]> {
      return db
        .select(paycheckListColumns)
        .from(paychecks)
        .leftJoin(documents, eq(paychecks.documentId, documents.id))
        .where(eq(paychecks.employmentId, employmentId))
        .orderBy(desc(paychecks.payDate), desc(paychecks.createdAt));
    },

    async getEmploymentDeductionSettings(
      employmentId: string,
    ): Promise<DeductionSettings> {
      const [employment] = await db
        .select({
          id: employments.id,
          deductionSettings: employments.deductionSettings,
        })
        .from(employments)
        .where(eq(employments.id, employmentId));

      if (!employment) {
        throw notFound("Employment not found.");
      }

      return parseDeductionSettings(employment.deductionSettings);
    },

    async create(command: {
      employmentId: string;
      values: PaycheckWriteValues;
    }): Promise<PaycheckRecord> {
      const [paycheck] = await db
        .insert(paychecks)
        .values({
          employmentId: command.employmentId,
          ...command.values,
        })
        .returning(paycheckRecordColumns);

      if (!paycheck) {
        throw unexpected("Paycheck creation failed.");
      }

      return paycheck;
    },
  };
}

export type PaycheckRepository = ReturnType<typeof createPaycheckRepository>;
