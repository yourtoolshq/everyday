import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, test } from "vitest";

import { calendarDateSchema } from "~/lib/dates";
import { propertyFieldsSchema } from "~/lib/properties";
import * as schema from "~/server/db/schema";
import * as repository from "./repository";

test("validates real dates and ordered tenancy dates", () => {
  expect(calendarDateSchema.safeParse("2027-02-29").success).toBe(false);
  expect(calendarDateSchema.safeParse("2028-02-29").success).toBe(true);
  expect(
    propertyFieldsSchema.safeParse({
      name: "Rental",
      kind: "current_rental",
      leaseStartDate: "2026-10-01",
      leaseEndDate: "2026-09-30",
    }).success,
  ).toBe(false);
});
test("keeps visit files across lifecycle changes and history deletion, rejects cross-property links", async () => {
  const directory = await mkdtemp(join(tmpdir(), "roof-records-"));
  const client = createClient({ url: `file:${join(directory, "roof.db")}` });
  const db = drizzle(client, { schema });
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    const property = await repository.saveProperty(db, {
      name: "Cedar House",
      kind: "under_construction",
    });
    const other = await repository.saveProperty(db, {
      name: "Old apartment",
      kind: "past_rental",
    });
    const visit = await repository.saveEvent(db, {
      propertyId: property.id,
      title: "Structure visit",
      category: "visit",
      eventDate: "2027-01-12",
      eventTime: "14:30",
      status: "planned",
    });
    await expect(
      repository.requireEvent(db, other.id, visit.id),
    ).rejects.toThrow("this property");
    const [file] = await db
      .insert(schema.filesTable)
      .values({
        id: crypto.randomUUID(),
        storageKey: "fictional.png",
        originalFilename: "photo.png",
        mimeType: "image/png",
        sizeBytes: 10,
        endpoint: "document",
      })
      .returning();
    await repository.insertDocument(db, {
      propertyId: property.id,
      eventId: visit.id,
      title: "Framing photo",
      type: "photo",
      fileId: file!.id,
      originalFilename: "photo.png",
      mimeType: "image/png",
      sizeBytes: 10,
    });
    await repository.saveProperty(
      db,
      { name: property.name, kind: "owned" },
      property.id,
    );
    await repository.saveEvent(
      db,
      { ...visit, status: "completed", notes: "Checked framing." },
      visit.id,
    );
    expect((await repository.listEvents(db, property.id))[0]?.notes).toBe(
      "Checked framing.",
    );
    await repository.deleteEvent(db, visit.id);
    const documents = await repository.listDocuments(db, property.id);
    expect(documents).toHaveLength(1);
    expect(documents[0]?.eventId).toBeNull();
    expect((await repository.requireProperty(db, property.id)).kind).toBe(
      "owned",
    );
  } finally {
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
