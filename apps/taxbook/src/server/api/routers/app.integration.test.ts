import { Buffer } from "node:buffer";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "~/server/api/helpers";
import {
  createBusinessRecord,
  deleteBusinessRecord,
  getBusinessRecordAttachment,
  updateBusinessRecord,
} from "~/server/api/business-values";
import {
  createCraReferenceDocument,
  deleteCraReferenceDocument,
  getCraReferenceDocumentAttachment,
  listCraReferenceDocuments,
} from "~/server/api/cra-reference-values";
import {
  createAdjustment,
  createAssessment,
  createOriginalReturn,
  listFilingTimeline,
  updateAdjustment,
  updateOriginalReturn,
} from "~/server/api/filing-values";
import {
  createRecord,
  deleteRecord,
  getActiveAttachment,
  updateRecord,
} from "~/server/api/record-values";
import { createCaller } from "~/server/api/root";
import {
  createTaxDocument,
  getActiveTaxDocumentAttachment,
  updateTaxDocument,
} from "~/server/api/tax-document-values";
import * as schema from "~/server/db/schema";

const migrationsDirectory = new URL("../../../../drizzle/", import.meta.url);
const migration = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(new URL(file, migrationsDirectory), "utf8"))
  .join("\n")
  .replaceAll("--> statement-breakpoint", "");

describe("Tax Book API", () => {
  let client: Client;
  let caller: ReturnType<typeof createCaller>;
  let database: Database;
  let testDirectory: string;

  beforeEach(async () => {
    testDirectory = mkdtempSync(join(tmpdir(), "taxbook-test-"));
    client = createClient({ url: `file:${join(testDirectory, "test.db")}` });
    // Throwaway database: skipping fsyncs keeps libsql's synchronous calls from stalling the worker on slow CI disks.
    await client.execute("PRAGMA synchronous = OFF");
    await client.executeMultiple(migration);
    database = drizzle(client, { schema });
    caller = createCaller({ db: database, headers: new Headers() });
  });

  afterEach(() => {
    client.close();
    rmSync(testDirectory, { recursive: true, force: true });
  });

  it("initializes exactly once with fictional household data", async () => {
    expect(await caller.setup.state()).toEqual({ initialized: false });
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    expect(await caller.setup.state()).toEqual({ initialized: true });
    await expect(
      caller.setup.initialize({
        householdName: "Another household",
        people: ["Person C"],
        year: 2027,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("creates items, aggregates the overview, and isolates tax years", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const settings = await caller.settings.get();
    const person = settings.people[0]!;
    await caller.taxItem.create({
      name: "Example employment income",
      taxLineReference: "10100",
      type: "income",
      ownerKind: "person",
      personId: person.id,
      expectedAmountCents: 5000000,
      actualAmountCents: 1250000,
      status: "in_progress",
      notes: null,
    });
    await caller.taxItem.create({
      name: "Example contribution",
      taxLineReference: "20800",
      type: "deduction_contribution",
      ownerKind: "household",
      personId: null,
      expectedAmountCents: 200000,
      actualAmountCents: null,
      status: "planned",
      notes: "Fictional test note",
    });

    const overview = await caller.taxItem.overview();
    expect(overview.amounts.income.actualAmountCents).toBe(1250000);
    expect(overview.amounts.deduction_contribution.expectedAmountCents).toBe(
      200000,
    );
    expect(overview.statuses).toMatchObject({ planned: 1, in_progress: 1 });
    expect((await caller.taxItem.list()).items[0]).toMatchObject({
      taxLineReference: "20800",
    });

    const originalYear = (await caller.taxYear.list()).find(
      (year) => year.isActive,
    )!;
    await caller.taxYear.create({ year: 2027 });
    expect((await caller.taxItem.list()).items).toHaveLength(0);
    await caller.taxYear.setActive({ id: originalYear.id });
    expect((await caller.taxItem.list()).items).toHaveLength(2);
  });

  it("validates ownership and protects referenced or final people", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const settings = await caller.settings.get();
    const [personA, personB] = settings.people;
    await expect(
      caller.taxItem.create({
        name: "Invalid owner",
        taxLineReference: null,
        type: "other",
        ownerKind: "person",
        personId: null,
        expectedAmountCents: null,
        actualAmountCents: null,
        status: "planned",
        notes: null,
      }),
    ).rejects.toBeDefined();
    await caller.taxItem.create({
      name: "Owned item",
      taxLineReference: null,
      type: "other",
      ownerKind: "person",
      personId: personA!.id,
      expectedAmountCents: 0,
      actualAmountCents: null,
      status: "complete",
      notes: null,
    });
    await expect(
      caller.settings.deletePerson({ id: personA!.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await caller.settings.deletePerson({ id: personB!.id });
    await expect(
      caller.settings.deletePerson({ id: personA!.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updates and deletes items while preserving a recorded zero", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A"],
      year: 2026,
    });
    const created = await caller.taxItem.create({
      name: "Example item",
      taxLineReference: null,
      type: "other",
      ownerKind: "household",
      personId: null,
      expectedAmountCents: null,
      actualAmountCents: null,
      status: "planned",
      notes: null,
    });
    await caller.taxItem.update({
      id: created!.id,
      name: "Updated example item",
      taxLineReference: "Schedule 1",
      type: "other",
      ownerKind: "household",
      personId: null,
      expectedAmountCents: null,
      actualAmountCents: 0,
      status: "complete",
      notes: null,
    });
    expect((await caller.taxItem.list()).items[0]).toMatchObject({
      name: "Updated example item",
      taxLineReference: "Schedule 1",
      actualAmountCents: 0,
      status: "complete",
    });
    await caller.taxItem.delete({ id: created!.id });
    expect((await caller.taxItem.list()).items).toHaveLength(0);
  });

  it("manages household and unreferenced people", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A"],
      year: 2026,
    });
    await caller.settings.renameHousehold({
      name: "Renamed example household",
    });
    const added = await caller.settings.addPerson({ name: "Person B" });
    await caller.settings.renamePerson({ id: added!.id, name: "Person C" });
    let settings = await caller.settings.get();
    expect(settings.household.name).toBe("Renamed example household");
    expect(settings.people.map((person) => person.name)).toEqual([
      "Person A",
      "Person C",
    ]);
    await caller.settings.deletePerson({ id: added!.id });
    settings = await caller.settings.get();
    expect(settings.people.map((person) => person.name)).toEqual(["Person A"]);
  });

  it("tracks paycheques and keeps employment Tax Items synchronized", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const [personA, personB] = (await caller.settings.get()).people;
    const current = await caller.employment.create({
      personId: personA!.id,
      employerName: "Employer A",
      payFrequency: "biweekly",
      status: "active",
      endDate: null,
      typicalGrossOverrideCents: null,
      wiEnabled: true,
      ltdEnabled: true,
    });
    const previous = await caller.employment.create({
      personId: personB!.id,
      employerName: "Employer B",
      payFrequency: "monthly",
      status: "ended",
      endDate: "2026-03-31",
      typicalGrossOverrideCents: null,
    });

    const first = await caller.paycheque.create({
      employmentId: current!.id,
      payDate: "2026-06-05",
      grossPayCents: 100_000,
      incomeTaxCents: 20_000,
      cppCents: 5_000,
      cpp2Cents: 0,
      eiCents: 2_000,
      wiCents: 1_000,
      ltdCents: 2_000,
      otherDeductionsCents: 0,
    });
    const second = await caller.paycheque.create({
      employmentId: current!.id,
      payDate: "2026-06-19",
      grossPayCents: 120_000,
      incomeTaxCents: 24_000,
      cppCents: 6_000,
      cpp2Cents: 500,
      eiCents: 2_400,
      otherDeductionsCents: 3_000,
    });
    await caller.paycheque.create({
      employmentId: previous!.id,
      payDate: "2026-03-31",
      grossPayCents: 90_000,
      incomeTaxCents: 18_000,
      cppCents: 4_500,
      cpp2Cents: 0,
      eiCents: 1_800,
      otherDeductionsCents: 0,
    });

    let employmentList = await caller.employment.list();
    expect(employmentList.items).toHaveLength(2);
    expect(
      employmentList.items.find((item) => item.id === current!.id)?.projection,
    ).toMatchObject({
      actualGrossCents: 220_000,
      averageGrossCents: 110_000,
    });
    expect(
      employmentList.items.find((item) => item.id === previous!.id)?.projection,
    ).toMatchObject({
      actualGrossCents: 90_000,
      projectedGrossCents: 90_000,
      remainingPaycheques: 0,
    });
    expect(
      (await caller.paycheque.list()).items.find(
        (item) => item.id === first!.id,
      ),
    ).toMatchObject({
      wiCents: 1_000,
      ltdCents: 2_000,
      netPayCents: 70_000,
    });

    let items = (await caller.taxItem.list()).items;
    const currentItem = items.find(
      (item) => item.name === "Employment income — Employer A",
    )!;
    expect(currentItem).toMatchObject({
      actualAmountCents: 220_000,
      ownerKind: "person",
      personId: personA!.id,
      taxLineReference: "10100",
      valueSource: "paycheques",
    });
    await expect(
      caller.taxItem.delete({ id: currentItem.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await caller.paycheque.update({
      id: second!.id,
      employmentId: current!.id,
      payDate: "2026-06-19",
      grossPayCents: 140_000,
      incomeTaxCents: 28_000,
      cppCents: 7_000,
      cpp2Cents: 700,
      eiCents: 2_800,
      otherDeductionsCents: 3_000,
    });
    items = (await caller.taxItem.list()).items;
    expect(
      items.find((item) => item.id === currentItem.id)?.actualAmountCents,
    ).toBe(240_000);

    await caller.paycheque.delete({ id: first!.id });
    employmentList = await caller.employment.list();
    expect(
      employmentList.items.find((item) => item.id === current!.id)?.projection
        ?.actualGrossCents,
    ).toBe(140_000);

    await caller.employment.delete({ id: previous!.id });
    expect((await caller.paycheque.list()).items).toHaveLength(1);
    expect((await caller.taxItem.list()).items).toHaveLength(1);
  });

  it("computes combined income tax from federal and Manitoba withholding", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const [personA] = (await caller.settings.get()).people;
    const employment = await caller.employment.create({
      personId: personA!.id,
      employerName: "Employer A",
      payFrequency: "biweekly",
      status: "active",
      endDate: null,
      typicalGrossOverrideCents: null,
      federalIncomeTaxEnabled: true,
      manitobaIncomeTaxEnabled: true,
      deductionFieldOrder: [
        "cppCents",
        "federalIncomeTaxCents",
        "eiCents",
        "manitobaIncomeTaxCents",
        "incomeTaxCents",
      ],
    });

    const listed = (await caller.employment.list()).items.find(
      (item) => item.id === employment!.id,
    );
    expect(listed).toMatchObject({
      incomeTaxEnabled: true,
      federalIncomeTaxEnabled: true,
      manitobaIncomeTaxEnabled: true,
    });
    expect(listed?.deductionFieldOrder?.slice(0, 5)).toEqual([
      "cppCents",
      "federalIncomeTaxCents",
      "eiCents",
      "manitobaIncomeTaxCents",
      "incomeTaxCents",
    ]);

    const paycheque = await caller.paycheque.create({
      employmentId: employment!.id,
      payDate: "2026-06-19",
      grossPayCents: 200_000,
      incomeTaxCents: 0,
      federalIncomeTaxCents: 20_000,
      manitobaIncomeTaxCents: 15_000,
      cppCents: 11_000,
      cpp2Cents: 1_000,
      eiCents: 3_200,
      otherDeductionsCents: 4_800,
    });
    expect(paycheque).toMatchObject({
      incomeTaxCents: 35_000,
      federalIncomeTaxCents: 20_000,
      manitobaIncomeTaxCents: 15_000,
      netPayCents: 145_000,
    });
  });

  it("links PHSP and union-dues paycheque deductions to Tax Items when reported on T4", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const [personA] = (await caller.settings.get()).people;
    const employment = await caller.employment.create({
      personId: personA!.id,
      employerName: "Employer A",
      payFrequency: "biweekly",
      status: "active",
      endDate: null,
      typicalGrossOverrideCents: null,
      extendedHealthEnabled: true,
      travelMedicalEnabled: true,
      unionDuesEnabled: true,
      phspReportedOnT4: true,
      unionDuesReportedOnT4: true,
    });

    await caller.paycheque.create({
      employmentId: employment!.id,
      payDate: "2026-06-05",
      grossPayCents: 100_000,
      incomeTaxCents: 20_000,
      cppCents: 5_000,
      cpp2Cents: 0,
      eiCents: 2_000,
      extendedHealthCents: 1_200,
      travelMedicalCents: 800,
      unionDuesCents: 3_500,
      otherDeductionsCents: 0,
    });
    await caller.paycheque.create({
      employmentId: employment!.id,
      payDate: "2026-06-19",
      grossPayCents: 100_000,
      incomeTaxCents: 20_000,
      cppCents: 5_000,
      cpp2Cents: 0,
      eiCents: 2_000,
      extendedHealthCents: 1_200,
      travelMedicalCents: 800,
      unionDuesCents: 3_500,
      otherDeductionsCents: 0,
    });

    const items = (await caller.taxItem.list()).items;
    expect(
      items.find((item) => item.name === "PHSP premiums — Employer A"),
    ).toMatchObject({
      actualAmountCents: 4_000,
      ownerKind: "household",
      taxTreatment: "medical_expense",
      valueSource: "paycheques",
    });
    expect(
      items.find((item) => item.name === "Union dues — Employer A"),
    ).toMatchObject({
      actualAmountCents: 7_000,
      ownerKind: "person",
      personId: personA!.id,
      taxTreatment: "professional_dues",
      valueSource: "paycheques",
    });

    const estimate = await caller.taxEstimate.get();
    expect(estimate.supported).toBe(true);
    expect(estimate.inputs?.actual.medicalExpensesCents).toBe(4_000);
    expect(
      estimate.actual?.people.find((person) => person.personId === personA!.id)
        ?.deductionBreakdown.professionalDuesCents,
    ).toBe(7_000);

    await caller.employment.update({
      id: employment!.id,
      personId: personA!.id,
      employerName: "Employer A",
      payFrequency: "biweekly",
      status: "active",
      endDate: null,
      typicalGrossOverrideCents: null,
      extendedHealthEnabled: true,
      travelMedicalEnabled: true,
      unionDuesEnabled: true,
      phspReportedOnT4: false,
      unionDuesReportedOnT4: true,
    });
    const afterPhspDisabled = (await caller.taxItem.list()).items;
    expect(
      afterPhspDisabled.find(
        (item) => item.name === "PHSP premiums — Employer A",
      ),
    ).toBeUndefined();
    expect(
      afterPhspDisabled.find((item) => item.name === "Union dues — Employer A")
        ?.actualAmountCents,
    ).toBe(7_000);
  });

  it("keeps employment and paycheque data inside the active tax year", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A"],
      year: 2026,
    });
    const person = (await caller.settings.get()).people[0]!;
    const employment = await caller.employment.create({
      personId: person.id,
      employerName: "Employer A",
      payFrequency: "weekly",
      status: "active",
      endDate: null,
      typicalGrossOverrideCents: null,
    });
    await expect(
      caller.paycheque.create({
        employmentId: employment!.id,
        payDate: "2025-12-31",
        grossPayCents: 100_000,
        incomeTaxCents: 0,
        cppCents: 0,
        cpp2Cents: 0,
        eiCents: 0,
        otherDeductionsCents: 0,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await caller.taxYear.create({ year: 2027 });
    expect((await caller.employment.list()).items).toHaveLength(0);
    expect((await caller.paycheque.list()).items).toHaveLength(0);
  });

  it("tracks supporting Records and keeps their Tax Item total synchronized", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const [personA] = (await caller.settings.get()).people;
    const item = await caller.taxItem.create({
      name: "Example medical expenses",
      taxLineReference: "33099",
      type: "eligible_expense",
      ownerKind: "household",
      personId: null,
      expectedAmountCents: null,
      actualAmountCents: 50_000,
      status: "in_progress",
      notes: null,
    });

    await expect(
      createRecord(
        database,
        {
          taxItemId: item!.id,
          date: "2025-12-15",
          description: "Example appointment",
          amountCents: 12_500,
          personId: personA!.id,
          notes: "Fictional supporting note",
          confirmReplaceActual: false,
        },
        null,
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    const first = await createRecord(
      database,
      {
        taxItemId: item!.id,
        date: "2025-12-15",
        description: "Example appointment",
        amountCents: 12_500,
        personId: personA!.id,
        notes: "Fictional supporting note",
        confirmReplaceActual: true,
      },
      {
        fileName: "fictional-receipt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 8,
        data: Buffer.from("example"),
      },
    );
    const second = await createRecord(
      database,
      {
        taxItemId: item!.id,
        date: "2026-02-10",
        description: "Example prescription",
        amountCents: 2_500,
        personId: null,
        notes: null,
        confirmReplaceActual: false,
      },
      null,
    );

    let detail = await caller.taxItem.get({ id: item!.id });
    expect(detail.item).toMatchObject({
      actualAmountCents: 15_000,
      valueSource: "records",
      recordCount: 2,
    });
    const listed = await caller.record.list({ taxItemId: item!.id });
    expect(listed.items.map((record) => record.description)).toEqual([
      "Example prescription",
      "Example appointment",
    ]);
    expect(listed.items.find((record) => record.id === first.id)).toMatchObject(
      {
        personName: "Person A",
        attachmentFileName: "fictional-receipt.pdf",
      },
    );
    expect(
      (await getActiveAttachment(database, first.id)).data.toString(),
    ).toBe("example");
    await expect(
      caller.settings.deletePerson({ id: personA!.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await updateRecord(
      database,
      first.id,
      {
        date: "2025-12-15",
        description: "Updated example appointment",
        amountCents: 10_000,
        personId: personA!.id,
        notes: null,
      },
      {
        type: "replace",
        attachment: {
          fileName: "replacement.png",
          mimeType: "image/png",
          sizeBytes: 11,
          data: Buffer.from("replacement"),
        },
      },
    );
    detail = await caller.taxItem.get({ id: item!.id });
    expect(detail.item.actualAmountCents).toBe(12_500);
    expect(await getActiveAttachment(database, first.id)).toMatchObject({
      fileName: "replacement.png",
      mimeType: "image/png",
    });
    await updateRecord(
      database,
      first.id,
      {
        date: "2025-12-15",
        description: "Updated example appointment",
        amountCents: 10_000,
        personId: personA!.id,
        notes: null,
      },
      { type: "remove" },
    );
    await expect(getActiveAttachment(database, first.id)).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );

    await deleteRecord(database, first.id);
    await deleteRecord(database, second.id);
    detail = await caller.taxItem.get({ id: item!.id });
    expect(detail.item).toMatchObject({
      actualAmountCents: null,
      valueSource: "manual",
      recordCount: 0,
    });

    const cascading = await createRecord(
      database,
      {
        taxItemId: item!.id,
        date: "2026-03-01",
        description: "Example cascading Record",
        amountCents: 1_000,
        personId: null,
        notes: null,
        confirmReplaceActual: false,
      },
      {
        fileName: "cascade.pdf",
        mimeType: "application/pdf",
        sizeBytes: 7,
        data: Buffer.from("cascade"),
      },
    );
    await caller.taxItem.delete({ id: item!.id });
    expect(
      await database.query.records.findFirst({
        where: (table, operators) => operators.eq(table.id, cascading.id),
      }),
    ).toBeUndefined();
    expect(
      await database.query.recordAttachments.findFirst({
        where: (table, operators) => operators.eq(table.recordId, cascading.id),
      }),
    ).toBeUndefined();
  });

  it("rejects Records on paycheque-calculated items and outside the active year", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A"],
      year: 2026,
    });
    const person = (await caller.settings.get()).people[0]!;
    await caller.employment.create({
      personId: person.id,
      employerName: "Employer A",
      payFrequency: "biweekly",
      status: "active",
      endDate: null,
      typicalGrossOverrideCents: null,
    });
    const employmentItem = (await caller.taxItem.list()).items[0]!;
    await expect(
      createRecord(
        database,
        {
          taxItemId: employmentItem.id,
          date: "2026-04-01",
          description: "Example pay evidence",
          amountCents: 100,
          personId: person.id,
          notes: null,
          confirmReplaceActual: true,
        },
        null,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const manualItem = await caller.taxItem.create({
      name: "Example contribution",
      taxLineReference: "20800",
      type: "deduction_contribution",
      ownerKind: "person",
      personId: person.id,
      expectedAmountCents: null,
      actualAmountCents: null,
      status: "planned",
      notes: null,
    });
    await caller.taxYear.create({ year: 2027 });
    await expect(
      createRecord(
        database,
        {
          taxItemId: manualItem!.id,
          date: "2027-01-15",
          description: "Example contribution",
          amountCents: 10_000,
          personId: person.id,
          notes: null,
          confirmReplaceActual: false,
        },
        null,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("tracks official Tax Documents, readiness, ownership, and attachments", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const [personA, personB] = (await caller.settings.get()).people;
    const personItem = await caller.taxItem.create({
      name: "Example employment income",
      taxLineReference: "10100",
      type: "income",
      ownerKind: "person",
      personId: personA!.id,
      expectedAmountCents: null,
      actualAmountCents: null,
      status: "complete",
      notes: null,
    });
    const householdItem = await caller.taxItem.create({
      name: "Example contribution",
      taxLineReference: "20800",
      type: "deduction_contribution",
      ownerKind: "household",
      personId: null,
      expectedAmountCents: null,
      actualAmountCents: null,
      status: "in_progress",
      notes: null,
    });

    const expected = await createTaxDocument(
      database,
      {
        taxItemId: personItem!.id,
        type: "t4",
        customTypeName: null,
        issuer: "Employer A",
        personId: null,
        notes: null,
      },
      null,
    );
    const received = await createTaxDocument(
      database,
      {
        taxItemId: householdItem!.id,
        type: "other",
        customTypeName: "T4A",
        issuer: "Issuer A",
        personId: personB!.id,
        notes: "Fictional document note",
      },
      {
        fileName: "fictional-slip.pdf",
        mimeType: "application/pdf",
        sizeBytes: 8,
        data: Buffer.from("example"),
      },
    );

    expect(expected.status).toBe("expected");
    expect(received.status).toBe("received");
    const list = await caller.taxDocument.list();
    expect(
      list.items.find((document) => document.id === expected.id),
    ).toMatchObject({
      taxItemName: "Example employment income",
      personName: "Person A",
    });
    expect(
      list.items.find((document) => document.id === received.id),
    ).toMatchObject({
      customTypeName: "T4A",
      personName: "Person B",
      attachmentFileName: "fictional-slip.pdf",
    });
    expect(await caller.taxDocument.overview()).toMatchObject({
      total: 2,
      isReady: false,
      counts: { expected: 1, received: 1, ready: 0, used: 0 },
    });
    expect(
      (
        await getActiveTaxDocumentAttachment(database, received.id)
      ).data.toString(),
    ).toBe("example");

    await updateTaxDocument(
      database,
      expected.id,
      {
        type: "t4",
        customTypeName: null,
        issuer: "Employer A",
        personId: null,
        status: "expected",
        notes: null,
      },
      {
        type: "replace",
        attachment: {
          fileName: "fictional-t4.png",
          mimeType: "image/png",
          sizeBytes: 11,
          data: Buffer.from("replacement"),
        },
      },
    );
    expect(
      (await caller.taxDocument.list()).items.find(
        (document) => document.id === expected.id,
      )?.status,
    ).toBe("received");

    for (const document of [expected, received]) {
      await updateTaxDocument(
        database,
        document.id,
        {
          type: document.type,
          customTypeName: document.customTypeName,
          issuer: document.issuer,
          personId: document.id === received.id ? personB!.id : null,
          status: document.id === received.id ? "used" : "ready",
          notes: document.notes,
        },
        document.id === expected.id ? { type: "remove" } : { type: "keep" },
      );
    }
    expect(await caller.taxDocument.overview()).toMatchObject({
      total: 2,
      isReady: true,
    });
    await expect(
      getActiveTaxDocumentAttachment(database, expected.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await caller.taxItem.delete({ id: householdItem!.id });
    expect(
      await database.query.taxDocuments.findFirst({
        where: (table, operators) => operators.eq(table.id, received.id),
      }),
    ).toBeUndefined();
    expect(
      await database.query.taxDocumentAttachments.findFirst({
        where: (table, operators) =>
          operators.eq(table.taxDocumentId, received.id),
      }),
    ).toBeUndefined();
  });

  it("isolates Tax Documents to the active tax year", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A"],
      year: 2026,
    });
    const item = await caller.taxItem.create({
      name: "Example item",
      taxLineReference: null,
      type: "other",
      ownerKind: "household",
      personId: null,
      expectedAmountCents: null,
      actualAmountCents: null,
      status: "planned",
      notes: null,
    });
    const document = await createTaxDocument(
      database,
      {
        taxItemId: item!.id,
        type: "t5",
        customTypeName: null,
        issuer: "Financial institution",
        personId: null,
        notes: null,
      },
      null,
    );
    await caller.taxYear.create({ year: 2027 });
    expect((await caller.taxDocument.list()).items).toHaveLength(0);
    expect(await caller.taxDocument.overview()).toMatchObject({
      total: 0,
      isReady: false,
    });
    await expect(
      updateTaxDocument(
        database,
        document.id,
        {
          type: "t5",
          customTypeName: null,
          issuer: "Financial institution",
          personId: null,
          status: "received",
          notes: null,
        },
        { type: "keep" },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("builds a mapped 2026 estimate and keeps scenarios temporary", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const [personA, personB] = (await caller.settings.get()).people;
    const interest = await caller.taxItem.create({
      name: "Interest from Financial Institution",
      taxLineReference: "12100",
      type: "income",
      ownerKind: "person",
      personId: personA!.id,
      expectedAmountCents: 50_000,
      actualAmountCents: 25_000,
      status: "in_progress",
      notes: null,
      taxTreatment: "interest_income",
    });
    const rent = await caller.taxItem.create({
      name: "Eligible rent",
      taxLineReference: "Form MB479",
      type: "eligible_expense",
      ownerKind: "household",
      personId: null,
      expectedAmountCents: 1_200_000,
      actualAmountCents: null,
      status: "in_progress",
      notes: null,
      taxTreatment: "manitoba_eligible_rent",
    });
    await caller.taxItem.create({
      name: "Eligible school tax",
      taxLineReference: "Form MB479",
      type: "eligible_expense",
      ownerKind: "household",
      personId: null,
      expectedAmountCents: 200_000,
      actualAmountCents: 200_000,
      status: "complete",
      notes: null,
      taxTreatment: "manitoba_eligible_school_tax",
    });
    await caller.taxItem.create({
      name: "Homeowner advance",
      taxLineReference: "Form MB479",
      type: "credit_benefit",
      ownerKind: "household",
      personId: null,
      expectedAmountCents: 10_000,
      actualAmountCents: 10_000,
      status: "complete",
      notes: null,
      taxTreatment: "manitoba_homeowner_advance",
    });
    await createRecord(
      database,
      {
        taxItemId: rent!.id,
        date: "2026-01-01",
        description: "January rent",
        amountCents: 100_000,
        personId: null,
        notes: null,
        confirmReplaceActual: false,
      },
      null,
    );
    await createRecord(
      database,
      {
        taxItemId: rent!.id,
        date: "2026-02-01",
        description: "February rent",
        amountCents: 100_000,
        personId: null,
        notes: null,
        confirmReplaceActual: false,
      },
      null,
    );
    const inferredRentEstimate = await caller.taxEstimate.get();
    expect(inferredRentEstimate.supported).toBe(true);
    if (!inferredRentEstimate.supported) return;
    expect(inferredRentEstimate.rentMonths).toEqual(["2026-01", "2026-02"]);
    expect(
      inferredRentEstimate.projected.manitobaCredits.renterCreditCents,
    ).toBe(10_417);
    expect(inferredRentEstimate.inputs.projected).toMatchObject({
      eligibleSchoolTaxCents: 200_000,
      homeownerAdvanceReceivedCents: 10_000,
      homeOwnershipDays: 306,
    });
    expect(
      inferredRentEstimate.projected.manitobaCredits.homeownerCreditCents,
    ).toBe(124_137);
    const estimate = await caller.taxEstimate.get();
    expect(estimate.supported).toBe(true);
    if (!estimate.supported) return;
    expect(estimate.rentMonths).toEqual(["2026-01", "2026-02"]);
    expect(estimate.projected.manitobaCredits.renterCreditCents).toBe(10_417);
    expect(
      estimate.projected.people.find(
        (person) => person.personId === personA!.id,
      )?.inputs.interestIncomeCents,
    ).toBe(50_000);
    const scenario = await caller.taxEstimate.calculateScenario({
      people: [
        {
          personId: personA!.id,
          rrspContributionCents: 100_000,
          rrspDeductionCents: 100_000,
          fhsaContributionCents: 0,
          fhsaDeductionCents: 0,
        },
        {
          personId: personB!.id,
          rrspContributionCents: 0,
          rrspDeductionCents: 0,
          fhsaContributionCents: 0,
          fhsaDeductionCents: 0,
        },
      ],
    });
    expect("comparison" in scenario).toBe(true);
    expect(
      (await caller.taxItem.get({ id: interest!.id })).item.expectedAmountCents,
    ).toBe(50_000);
  });

  it("tracks separate self-employment activities, losses, and managed Tax Items", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const [personA, personB] = (await caller.settings.get()).people;
    const web = await caller.business.create({
      name: "Web services",
      personId: personA!.id,
    });
    const media = await caller.business.create({
      name: "Media activity",
      personId: personB!.id,
    });
    await createBusinessRecord(
      database,
      {
        businessActivityId: web.id,
        kind: "revenue",
        expenseCategory: null,
        date: "2026-02-10",
        description: "Project payment",
        amountCents: 50_000,
        notes: null,
      },
      null,
    );
    const expense = await createBusinessRecord(
      database,
      {
        businessActivityId: web.id,
        kind: "expense",
        expenseCategory: "office_expenses",
        date: "2026-02-11",
        description: "Software",
        amountCents: 80_000,
        notes: null,
      },
      {
        fileName: "fictional-expense.pdf",
        mimeType: "application/pdf",
        sizeBytes: 7,
        data: Buffer.from("example"),
      },
    );
    await createBusinessRecord(
      database,
      {
        businessActivityId: media.id,
        kind: "revenue",
        expenseCategory: null,
        date: "2026-03-01",
        description: "Platform income",
        amountCents: 25_000,
        notes: null,
      },
      null,
    );
    expect(
      (await caller.business.list()).items.map((item) => item.totals.net),
    ).toEqual([-30_000, 25_000]);
    const webItem = (await caller.taxItem.list()).items.find(
      (item) => item.businessActivityId === web.id,
    )!;
    expect(webItem).toMatchObject({
      actualAmountCents: -30_000,
      valueSource: "self_employment",
      taxTreatment: "self_employment_income",
    });
    expect(
      (await getBusinessRecordAttachment(database, expense.id)).data.toString(),
    ).toBe("example");
    await expect(
      caller.taxItem.update({
        id: webItem.id,
        name: "Changed",
        taxLineReference: null,
        type: "income",
        ownerKind: "person",
        personId: personA!.id,
        expectedAmountCents: null,
        actualAmountCents: 0,
        status: "complete",
        notes: null,
        taxTreatment: null,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const estimate = await caller.taxEstimate.get();
    expect(estimate.supported).toBe(true);
    if (estimate.supported) {
      expect(
        estimate.actual.people.find((person) => person.personId === personA!.id)
          ?.inputs.selfEmploymentIncomeCents,
      ).toBe(-30_000);
      expect(
        estimate.actual.people.find((person) => person.personId === personA!.id)
          ?.selfEmploymentCppPayableCents,
      ).toBe(0);
    }
    await updateBusinessRecord(
      database,
      expense.id,
      {
        kind: "expense",
        expenseCategory: "supplies",
        date: "2026-02-11",
        description: "Software and supplies",
        amountCents: 40_000,
        notes: null,
      },
      { type: "keep" },
    );
    expect((await caller.business.list()).items[0]!.totals.net).toBe(10_000);
    await deleteBusinessRecord(database, expense.id);
    expect((await caller.business.list()).items[0]!.totals.net).toBe(50_000);
    await caller.taxYear.create({ year: 2027 });
    expect((await caller.business.list()).items).toHaveLength(0);
  });

  it("records historical filing history with unavailable T1 and NOA", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const activeYear = (await caller.settings.get()).years.find(
      (year) => year.isActive,
    )!;
    const pastYear = await caller.taxYear.createPast({ year: 2023 });
    if (!pastYear) throw new Error("Expected past tax year to be created.");
    expect(pastYear.isActive).toBe(false);
    expect(
      (await caller.settings.get()).years.find((year) => year.isActive)?.id,
    ).toBe(activeYear.id);

    const [personA] = (await caller.settings.get()).people;
    const filing = await createOriginalReturn(
      database,
      pastYear.id,
      {
        personId: personA!.id,
        submissionDate: "2024-04-15",
        expectedResultCents: null,
        returnCopyStatus: "unavailable",
        notes: "Original copy no longer available.",
      },
      null,
    );
    await updateOriginalReturn(
      database,
      filing.id,
      {
        submissionDate: "2024-04-15",
        expectedResultCents: null,
        returnCopyStatus: "unavailable",
        notes: "Original copy no longer available.",
        status: "submitted",
      },
      { type: "keep" },
    );
    await createAssessment(
      database,
      filing.id,
      {
        assessmentDate: "2024-05-01",
        assessedResultCents: 125_000,
        refundOrPaymentDate: "2024-05-15",
        notes: null,
      },
      {
        fileName: "fictional-noa.pdf",
        mimeType: "application/pdf",
        sizeBytes: 7,
        data: Buffer.from("example"),
      },
    );

    const timeline = await listFilingTimeline(database, pastYear.id);
    expect(timeline.filings).toHaveLength(1);
    expect(timeline.filings[0]).toMatchObject({
      personId: personA!.id,
      returnCopyStatus: "unavailable",
      status: "assessed",
      assessedResultCents: 125_000,
      assessmentAttachmentFileName: "fictional-noa.pdf",
    });
    expect(
      (await caller.filing.timeline({ taxYearId: pastYear.id })).filings,
    ).toHaveLength(1);
  });

  it("records adjustments and reassessments in chronological order", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const settings = await caller.settings.get();
    const year = settings.years.find((item) => item.isActive)!;
    const [personA] = settings.people;
    const taxItem = await caller.taxItem.create({
      name: "Medical expenses",
      taxLineReference: null,
      type: "eligible_expense",
      ownerKind: "person",
      personId: personA!.id,
      expectedAmountCents: null,
      actualAmountCents: 50_000,
      status: "complete",
      notes: null,
      taxTreatment: null,
    });

    const originalReturn = await createOriginalReturn(
      database,
      year.id,
      {
        personId: personA!.id,
        submissionDate: "2024-04-15",
        expectedResultCents: 100_00,
        returnCopyStatus: "unavailable",
        notes: null,
      },
      null,
    );
    await updateOriginalReturn(
      database,
      originalReturn.id,
      {
        submissionDate: "2024-04-15",
        expectedResultCents: 100_00,
        returnCopyStatus: "unavailable",
        notes: null,
        status: "assessed",
      },
      { type: "keep" },
    );
    await createAssessment(
      database,
      originalReturn.id,
      {
        assessmentDate: "2024-05-01",
        assessedResultCents: 100_00,
        refundOrPaymentDate: null,
        notes: null,
      },
      null,
    );

    const adjustment = await createAdjustment(
      database,
      year.id,
      {
        personId: personA!.id,
        reason: "Missed medical expense",
        submissionDate: "2025-02-01",
        expectedChangeCents: 25_00,
        returnCopyStatus: "unavailable",
        notes: null,
        affectedTaxItemIds: [taxItem!.id],
      },
      null,
    );
    await updateAdjustment(
      database,
      adjustment.id,
      {
        reason: "Missed medical expense",
        submissionDate: "2025-02-01",
        expectedChangeCents: 25_00,
        returnCopyStatus: "unavailable",
        notes: null,
        affectedTaxItemIds: [taxItem!.id],
        status: "submitted",
      },
      { type: "keep" },
    );
    await createAssessment(
      database,
      adjustment.id,
      {
        assessmentDate: "2025-03-01",
        assessedResultCents: 125_00,
        refundOrPaymentDate: null,
        notes: null,
      },
      null,
    );

    const timeline = await listFilingTimeline(database, year.id);
    expect(timeline.filings).toHaveLength(2);
    expect(timeline.filings[0]).toMatchObject({
      kind: "original_return",
      status: "assessed",
    });
    expect(timeline.filings[1]).toMatchObject({
      kind: "adjustment",
      reason: "Missed medical expense",
      status: "assessed",
      assessedResultCents: 125_00,
      assessmentKind: "notice_of_reassessment",
      affectedTaxItems: [{ id: taxItem!.id, name: "Medical expenses" }],
    });
  });

  it("requires acknowledgement before applying lifecycle warnings", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const settings = await caller.settings.get();
    const year = settings.years.find((item) => item.isActive)!;
    const [personA] = settings.people;
    await createOriginalReturn(
      database,
      year.id,
      {
        personId: personA!.id,
        submissionDate: null,
        expectedResultCents: null,
        returnCopyStatus: "unavailable",
        notes: null,
      },
      null,
    );

    const preview = await caller.taxYear.updateStatus({
      id: year.id,
      status: "filed",
    });
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.warnings).toHaveLength(1);
    expect(preview.year.status).toBe("tracking");

    const applied = await caller.taxYear.updateStatus({
      id: year.id,
      status: "filed",
      acknowledgeWarnings: true,
    });
    expect(applied.requiresConfirmation).toBe(false);
    expect(applied.year.status).toBe("filed");
  });

  it("blocks tracked-data edits when the active year is archived", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const settings = await caller.settings.get();
    const year = settings.years.find((item) => item.isActive)!;
    const [personA] = settings.people;

    await caller.taxYear.updateStatus({
      id: year.id,
      status: "archived",
      acknowledgeWarnings: true,
    });

    await expect(
      caller.taxItem.create({
        name: "Example employment income",
        taxLineReference: "10100",
        type: "income",
        ownerKind: "person",
        personId: personA!.id,
        expectedAmountCents: null,
        actualAmountCents: null,
        status: "in_progress",
        notes: null,
        taxTreatment: null,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("archived"),
    });

    const pastYear = await caller.taxYear.createPast({ year: 2023 });
    await createOriginalReturn(
      database,
      pastYear!.id,
      {
        personId: personA!.id,
        submissionDate: "2024-04-15",
        expectedResultCents: null,
        returnCopyStatus: "unavailable",
        notes: null,
      },
      null,
    );
    expect(
      (await listFilingTimeline(database, pastYear!.id)).filings,
    ).toHaveLength(1);
  });

  it("stores CRA reference documents with attachments for a tax year", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const settings = await caller.settings.get();
    const year = settings.years.find((item) => item.isActive)!;
    const [personA] = settings.people;

    const document = await createCraReferenceDocument(
      database,
      {
        taxYearId: year.id,
        category: "gst_hst_return",
        title: "Q1 GST/HST return",
        personId: personA!.id,
        documentDate: "2026-04-30",
        reportingPeriodLabel: "Jan 1 – Mar 31, 2026",
        notes: null,
      },
      {
        fileName: "fictional-gst.pdf",
        mimeType: "application/pdf",
        sizeBytes: 8,
        data: Buffer.from("example"),
      },
    );

    const listed = await listCraReferenceDocuments(database, year.id);
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({
      id: document.id,
      category: "gst_hst_return",
      title: "Q1 GST/HST return",
      personName: "Person A",
      reportingPeriodLabel: "Jan 1 – Mar 31, 2026",
      attachmentFileName: "fictional-gst.pdf",
    });
    expect(
      (await caller.craReference.list({ taxYearId: year.id })).items,
    ).toHaveLength(1);

    const attachment = await getCraReferenceDocumentAttachment(
      database,
      document.id,
    );
    expect(attachment.fileName).toBe("fictional-gst.pdf");

    await deleteCraReferenceDocument(database, document.id);
    expect(
      (await listCraReferenceDocuments(database, year.id)).items,
    ).toHaveLength(0);
  });

  it("preserves filed tax item snapshots after tracked values change", async () => {
    await caller.setup.initialize({
      householdName: "Example household",
      people: ["Person A", "Person B"],
      year: 2026,
    });
    const settings = await caller.settings.get();
    const year = settings.years.find((item) => item.isActive)!;
    const [personA] = settings.people;
    const taxItem = await caller.taxItem.create({
      name: "Employment income",
      taxLineReference: "10100",
      type: "income",
      ownerKind: "person",
      personId: personA!.id,
      expectedAmountCents: 50_000_00,
      actualAmountCents: 48_000_00,
      status: "complete",
      notes: null,
      taxTreatment: null,
    });

    const originalReturn = await createOriginalReturn(
      database,
      year.id,
      {
        personId: personA!.id,
        submissionDate: "2026-04-15",
        expectedResultCents: 1_000_00,
        returnCopyStatus: "unavailable",
        notes: null,
        itemValues: [
          {
            taxItemId: taxItem!.id,
            itemName: "Employment income",
            ownerLabel: "Person A",
            taxLineReference: "10100",
            amountCents: 47_500_00,
            differenceNote: "Filed amount differed from tracked paycheques.",
          },
        ],
      },
      null,
    );

    await caller.taxItem.update({
      id: taxItem!.id,
      name: "Employment income",
      taxLineReference: "10100",
      type: "income",
      ownerKind: "person",
      personId: personA!.id,
      expectedAmountCents: 50_000_00,
      actualAmountCents: 49_000_00,
      status: "complete",
      notes: null,
      taxTreatment: null,
    });

    const timeline = await listFilingTimeline(database, year.id);
    expect(timeline.filings[0]).toMatchObject({
      id: originalReturn.id,
      itemValues: [
        {
          taxItemId: taxItem!.id,
          itemName: "Employment income",
          amountCents: 47_500_00,
          differenceNote: "Filed amount differed from tracked paycheques.",
        },
      ],
    });
  });
});
