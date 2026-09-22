import { and, asc, eq, gte } from "drizzle-orm";

import { db } from "~/server/db";
import { employments, employers, paychecks, people } from "~/server/db/schema";

export async function listIntegrationEmployments() {
  return db
    .select({
      id: employments.id,
      personId: employments.personId,
      personName: people.displayName,
      employerId: employments.employerId,
      employerName: employers.name,
      jobTitle: employments.jobTitle,
      status: employments.status,
      startDate: employments.startDate,
      endDate: employments.endDate,
      payFrequency: employments.payFrequency,
      biweeklyAnchorDate: employments.biweeklyAnchorDate,
      deductionSettings: employments.deductionSettings,
      createdAt: employments.createdAt,
      updatedAt: employments.updatedAt,
    })
    .from(employments)
    .innerJoin(employers, eq(employments.employerId, employers.id))
    .innerJoin(people, eq(employments.personId, people.id))
    .orderBy(asc(employers.name), asc(people.displayName));
}

export async function listIntegrationPaychecks(input: {
  employmentId: string;
  updatedSince?: string;
}) {
  const conditions = [eq(paychecks.employmentId, input.employmentId)];
  if (input.updatedSince) {
    conditions.push(gte(paychecks.updatedAt, input.updatedSince));
  }

  return db
    .select({
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
      hasStub: paychecks.documentId,
      createdAt: paychecks.createdAt,
      updatedAt: paychecks.updatedAt,
    })
    .from(paychecks)
    .where(and(...conditions))
    .orderBy(asc(paychecks.payDate), asc(paychecks.createdAt));
}
