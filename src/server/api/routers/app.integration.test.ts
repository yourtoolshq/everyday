import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCaller } from "~/server/api/root";
import {
  createRecord,
  deleteRecord,
  getActiveAttachment,
  updateRecord,
} from "~/server/api/record-values";
import {
  createTaxDocument,
  getActiveTaxDocumentAttachment,
  updateTaxDocument,
} from "~/server/api/tax-document-values";
import type { Database } from "~/server/api/helpers";
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
    expect(overview.amounts.deduction_contribution.expectedAmountCents).toBe(200000);
    expect(overview.statuses).toMatchObject({ planned: 1, in_progress: 1 });
    expect((await caller.taxItem.list()).items[0]).toMatchObject({
      taxLineReference: "20800",
    });

    const originalYear = (await caller.taxYear.list()).find((year) => year.isActive)!;
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
    await expect(caller.settings.deletePerson({ id: personA!.id })).rejects.toMatchObject({ code: "CONFLICT" });
    await caller.settings.deletePerson({ id: personB!.id });
    await expect(caller.settings.deletePerson({ id: personA!.id })).rejects.toMatchObject({ code: "CONFLICT" });
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
    await caller.settings.renameHousehold({ name: "Renamed example household" });
    const added = await caller.settings.addPerson({ name: "Person B" });
    await caller.settings.renamePerson({ id: added!.id, name: "Person C" });
    let settings = await caller.settings.get();
    expect(settings.household.name).toBe("Renamed example household");
    expect(settings.people.map((person) => person.name)).toEqual(["Person A", "Person C"]);
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
    expect(employmentList.items.find((item) => item.id === current!.id)?.projection).toMatchObject({
      actualGrossCents: 220_000,
      averageGrossCents: 110_000,
    });
    expect(employmentList.items.find((item) => item.id === previous!.id)?.projection).toMatchObject({
      actualGrossCents: 90_000,
      projectedGrossCents: 90_000,
      remainingPaycheques: 0,
    });
    expect((await caller.paycheque.list()).items.find((item) => item.id === first!.id)).toMatchObject({
      wiCents: 1_000,
      ltdCents: 2_000,
      netPayCents: 70_000,
    });

    let items = (await caller.taxItem.list()).items;
    const currentItem = items.find((item) => item.name === "Employment income — Employer A")!;
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
    expect(items.find((item) => item.id === currentItem.id)?.actualAmountCents).toBe(240_000);

    await caller.paycheque.delete({ id: first!.id });
    employmentList = await caller.employment.list();
    expect(employmentList.items.find((item) => item.id === current!.id)?.projection?.actualGrossCents).toBe(140_000);

    await caller.employment.delete({ id: previous!.id });
    expect((await caller.paycheque.list()).items).toHaveLength(1);
    expect((await caller.taxItem.list()).items).toHaveLength(1);
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
    expect(listed.items.find((record) => record.id === first.id)).toMatchObject({
      personName: "Person A",
      attachmentFileName: "fictional-receipt.pdf",
    });
    expect((await getActiveAttachment(database, first.id)).data.toString()).toBe("example");
    await expect(caller.settings.deletePerson({ id: personA!.id })).rejects.toMatchObject({ code: "CONFLICT" });

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
    await expect(getActiveAttachment(database, first.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

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
    expect(await database.query.records.findFirst({
      where: (table, operators) => operators.eq(table.id, cascading.id),
    })).toBeUndefined();
    expect(await database.query.recordAttachments.findFirst({
      where: (table, operators) => operators.eq(table.recordId, cascading.id),
    })).toBeUndefined();
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
      createRecord(database, {
        taxItemId: employmentItem.id,
        date: "2026-04-01",
        description: "Example pay evidence",
        amountCents: 100,
        personId: person.id,
        notes: null,
        confirmReplaceActual: true,
      }, null),
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
      createRecord(database, {
        taxItemId: manualItem!.id,
        date: "2027-01-15",
        description: "Example contribution",
        amountCents: 10_000,
        personId: person.id,
        notes: null,
        confirmReplaceActual: false,
      }, null),
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

    const expected = await createTaxDocument(database, {
      taxItemId: personItem!.id,
      type: "t4",
      customTypeName: null,
      issuer: "Employer A",
      personId: null,
      notes: null,
    }, null);
    const received = await createTaxDocument(database, {
      taxItemId: householdItem!.id,
      type: "other",
      customTypeName: "T4A",
      issuer: "Issuer A",
      personId: personB!.id,
      notes: "Fictional document note",
    }, {
      fileName: "fictional-slip.pdf",
      mimeType: "application/pdf",
      sizeBytes: 8,
      data: Buffer.from("example"),
    });

    expect(expected.status).toBe("expected");
    expect(received.status).toBe("received");
    const list = await caller.taxDocument.list();
    expect(list.items.find((document) => document.id === expected.id)).toMatchObject({
      taxItemName: "Example employment income",
      personName: "Person A",
    });
    expect(list.items.find((document) => document.id === received.id)).toMatchObject({
      customTypeName: "T4A",
      personName: "Person B",
      attachmentFileName: "fictional-slip.pdf",
    });
    expect(await caller.taxDocument.overview()).toMatchObject({
      total: 2,
      isReady: false,
      counts: { expected: 1, received: 1, ready: 0, used: 0 },
    });
    expect((await getActiveTaxDocumentAttachment(database, received.id)).data.toString()).toBe("example");

    await updateTaxDocument(database, expected.id, {
      type: "t4",
      customTypeName: null,
      issuer: "Employer A",
      personId: null,
      status: "expected",
      notes: null,
    }, {
      type: "replace",
      attachment: {
        fileName: "fictional-t4.png",
        mimeType: "image/png",
        sizeBytes: 11,
        data: Buffer.from("replacement"),
      },
    });
    expect((await caller.taxDocument.list()).items.find((document) => document.id === expected.id)?.status).toBe("received");

    for (const document of [expected, received]) {
      await updateTaxDocument(database, document.id, {
        type: document.type,
        customTypeName: document.customTypeName,
        issuer: document.issuer,
        personId: document.id === received.id ? personB!.id : null,
        status: document.id === received.id ? "used" : "ready",
        notes: document.notes,
      }, document.id === expected.id ? { type: "remove" } : { type: "keep" });
    }
    expect(await caller.taxDocument.overview()).toMatchObject({ total: 2, isReady: true });
    await expect(getActiveTaxDocumentAttachment(database, expected.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    await caller.taxItem.delete({ id: householdItem!.id });
    expect(await database.query.taxDocuments.findFirst({
      where: (table, operators) => operators.eq(table.id, received.id),
    })).toBeUndefined();
    expect(await database.query.taxDocumentAttachments.findFirst({
      where: (table, operators) => operators.eq(table.taxDocumentId, received.id),
    })).toBeUndefined();
  });

  it("isolates Tax Documents to the active tax year", async () => {
    await caller.setup.initialize({ householdName: "Example household", people: ["Person A"], year: 2026 });
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
    const document = await createTaxDocument(database, {
      taxItemId: item!.id,
      type: "t5",
      customTypeName: null,
      issuer: "Financial institution",
      personId: null,
      notes: null,
    }, null);
    await caller.taxYear.create({ year: 2027 });
    expect((await caller.taxDocument.list()).items).toHaveLength(0);
    expect(await caller.taxDocument.overview()).toMatchObject({ total: 0, isReady: false });
    await expect(updateTaxDocument(database, document.id, {
      type: "t5",
      customTypeName: null,
      issuer: "Financial institution",
      personId: null,
      status: "received",
      notes: null,
    }, { type: "keep" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("builds a mapped 2026 estimate and keeps scenarios temporary", async () => {
    await caller.setup.initialize({ householdName: "Example household", people: ["Person A", "Person B"], year: 2026 });
    const [personA, personB] = (await caller.settings.get()).people;
    const interest = await caller.taxItem.create({
      name: "Interest from Financial Institution", taxLineReference: "12100", type: "income",
      ownerKind: "person", personId: personA!.id, expectedAmountCents: 50_000,
      actualAmountCents: 25_000, status: "in_progress", notes: null, taxTreatment: "interest_income",
    });
    const rent = await caller.taxItem.create({
      name: "Eligible rent", taxLineReference: "Form MB479", type: "eligible_expense",
      ownerKind: "household", personId: null, expectedAmountCents: 1_200_000,
      actualAmountCents: null, status: "in_progress", notes: null, taxTreatment: "manitoba_eligible_rent",
    });
    await createRecord(database, { taxItemId: rent!.id, date: "2026-01-01", description: "January rent", amountCents: 100_000, personId: null, notes: null, confirmReplaceActual: false }, null);
    await createRecord(database, { taxItemId: rent!.id, date: "2026-02-01", description: "February rent", amountCents: 100_000, personId: null, notes: null, confirmReplaceActual: false }, null);
    await caller.taxEstimate.updateSettings({
      manitobaCreditsClaimantPersonId: personA!.id, housingMode: "renter",
      homeOwnershipStartDate: null, eligibleSchoolTaxCents: null,
      homeownerAdvanceReceivedCents: null,
      study: [
        { personId: personA!.id, fullTimeStudyMonths: 0, partTimeStudyMonths: 0 },
        { personId: personB!.id, fullTimeStudyMonths: 0, partTimeStudyMonths: 0 },
      ],
    });
    const estimate = await caller.taxEstimate.get();
    expect(estimate.supported).toBe(true);
    if (!estimate.supported) return;
    expect(estimate.rentMonths).toEqual(["2026-01", "2026-02"]);
    expect(estimate.projected.manitobaCredits.renterCreditCents).toBe(10_417);
    expect(estimate.projected.people.find((person) => person.personId === personA!.id)?.inputs.interestIncomeCents).toBe(50_000);
    const scenario = await caller.taxEstimate.calculateScenario({ people: [
      { personId: personA!.id, rrspContributionCents: 100_000, rrspDeductionCents: 100_000, fhsaContributionCents: 0, fhsaDeductionCents: 0 },
      { personId: personB!.id, rrspContributionCents: 0, rrspDeductionCents: 0, fhsaContributionCents: 0, fhsaDeductionCents: 0 },
    ] });
    expect("comparison" in scenario).toBe(true);
    expect((await caller.taxItem.get({ id: interest!.id })).item.expectedAmountCents).toBe(50_000);
  });
});
