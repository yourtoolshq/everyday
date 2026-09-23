import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import {
  serializePaychequesForTenure,
  tenurePaychequeExportFilename,
} from "~/lib/paycheque-export";
import { requireActiveYear, requireHousehold } from "~/server/api/helpers";
import { db } from "~/server/db";
import { employments, paycheques, people } from "~/server/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const household = await requireHousehold(db);
  const year = await requireActiveYear(db, household.id);
  const employmentIdParam = new URL(request.url).searchParams.get(
    "employmentId",
  );

  if (!employmentIdParam) {
    return NextResponse.json(
      { error: "employmentId is required." },
      { status: 400 },
    );
  }

  const employmentId = Number(employmentIdParam);
  if (!Number.isInteger(employmentId) || employmentId <= 0) {
    return NextResponse.json(
      { error: "employmentId must be a positive integer." },
      { status: 400 },
    );
  }

  const [employment] = await db
    .select({
      id: employments.id,
      employerName: employments.employerName,
      personName: people.name,
    })
    .from(employments)
    .innerJoin(people, eq(employments.personId, people.id))
    .where(
      and(eq(employments.id, employmentId), eq(employments.taxYearId, year.id)),
    );

  if (!employment) {
    return NextResponse.json(
      { error: "Employment not found." },
      { status: 404 },
    );
  }

  const rows = await db
    .select({
      payDate: paycheques.payDate,
      grossPayCents: paycheques.grossPayCents,
      incomeTaxCents: paycheques.incomeTaxCents,
      federalIncomeTaxCents: paycheques.federalIncomeTaxCents,
      manitobaIncomeTaxCents: paycheques.manitobaIncomeTaxCents,
      cppCents: paycheques.cppCents,
      cpp2Cents: paycheques.cpp2Cents,
      eiCents: paycheques.eiCents,
      wiCents: paycheques.wiCents,
      ltdCents: paycheques.ltdCents,
      extendedHealthCents: paycheques.extendedHealthCents,
      travelMedicalCents: paycheques.travelMedicalCents,
      unionDuesCents: paycheques.unionDuesCents,
      otherDeductionsCents: paycheques.otherDeductionsCents,
    })
    .from(paycheques)
    .where(eq(paycheques.employmentId, employment.id))
    .orderBy(asc(paycheques.payDate), asc(paycheques.id));

  const csv = serializePaychequesForTenure(
    rows.map((row) => ({
      ...row,
      employerName: employment.employerName,
      personName: employment.personName,
    })),
  );

  const filename = tenurePaychequeExportFilename({
    employerName: employment.employerName,
    taxYear: year.year,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
