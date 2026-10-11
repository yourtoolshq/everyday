import type { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";

import { invalidInput, notFound } from "@yourtoolshq/server/errors";

import type { db } from "~/server/db";
import { documentMetadataSchema } from "~/lib/documents";
import { eventFieldsSchema } from "~/lib/events";
import { propertyFieldsSchema } from "~/lib/properties";
import { documents, properties, propertyEvents } from "~/server/db/schema";

type Database = Pick<typeof db, "select" | "insert" | "update" | "delete">;
// Explicit read DTOs keep future internal columns out of transport responses.
const propertyProjection = {
  id: properties.id,
  name: properties.name,
  kind: properties.kind,
  addressLine1: properties.addressLine1,
  addressLine2: properties.addressLine2,
  city: properties.city,
  region: properties.region,
  postalCode: properties.postalCode,
  moveInDate: properties.moveInDate,
  moveOutDate: properties.moveOutDate,
  leaseStartDate: properties.leaseStartDate,
  leaseEndDate: properties.leaseEndDate,
  leaseNotes: properties.leaseNotes,
  landlordName: properties.landlordName,
  landlordEmail: properties.landlordEmail,
  landlordPhone: properties.landlordPhone,
  renterInsuranceProvider: properties.renterInsuranceProvider,
  renterInsurancePolicyNumber: properties.renterInsurancePolicyNumber,
  renterInsuranceExpiresOn: properties.renterInsuranceExpiresOn,
  targetPossessionDate: properties.targetPossessionDate,
  notes: properties.notes,
  createdAt: properties.createdAt,
  updatedAt: properties.updatedAt,
};
const eventProjection = {
  id: propertyEvents.id,
  propertyId: propertyEvents.propertyId,
  eventDate: propertyEvents.eventDate,
  eventTime: propertyEvents.eventTime,
  status: propertyEvents.status,
  category: propertyEvents.category,
  title: propertyEvents.title,
  notes: propertyEvents.notes,
  createdAt: propertyEvents.createdAt,
  updatedAt: propertyEvents.updatedAt,
};
const documentProjection = {
  id: documents.id,
  propertyId: documents.propertyId,
  eventId: documents.eventId,
  type: documents.type,
  title: documents.title,
  documentDate: documents.documentDate,
  notes: documents.notes,
  fileId: documents.fileId,
  originalFilename: documents.originalFilename,
  mimeType: documents.mimeType,
  sizeBytes: documents.sizeBytes,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

export async function requireProperty(database: Database, id: string) {
  const [property] = await database
    .select(propertyProjection)
    .from(properties)
    .where(eq(properties.id, id));
  if (!property) throw notFound("Property not found.");
  return property;
}
export function listProperties(database: Database) {
  return database
    .select(propertyProjection)
    .from(properties)
    .orderBy(asc(properties.kind), desc(properties.updatedAt));
}
export async function saveProperty(
  database: Database,
  input: z.infer<typeof propertyFieldsSchema>,
  id?: string,
) {
  input = propertyFieldsSchema.parse(input);
  const [property] = id
    ? await database
        .update(properties)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(eq(properties.id, id))
        .returning(propertyProjection)
    : await database
        .insert(properties)
        .values(input)
        .returning(propertyProjection);
  if (!property) throw notFound("Property not found.");
  return property;
}
export function listEvents(database: Database, propertyId: string) {
  return database
    .select(eventProjection)
    .from(propertyEvents)
    .where(eq(propertyEvents.propertyId, propertyId))
    .orderBy(desc(propertyEvents.eventDate), desc(propertyEvents.createdAt));
}
export async function saveEvent(
  database: Database,
  input: z.infer<typeof eventFieldsSchema>,
  id?: string,
) {
  input = eventFieldsSchema.parse(input);
  await requireProperty(database, input.propertyId);
  if (id) await requireEvent(database, input.propertyId, id);
  const [event] = id
    ? await database
        .update(propertyEvents)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(eq(propertyEvents.id, id))
        .returning(eventProjection)
    : await database
        .insert(propertyEvents)
        .values(input)
        .returning(eventProjection);
  if (!event) throw notFound("History entry not found.");
  return event;
}
export async function requireEvent(
  database: Database,
  propertyId: string,
  id?: string | null,
) {
  if (!id) return;
  const [event] = await database
    .select(eventProjection)
    .from(propertyEvents)
    .where(eq(propertyEvents.id, id));
  if (!event || event.propertyId !== propertyId)
    throw invalidInput("Choose a history entry from this property.");
  return event;
}
export async function deleteEvent(database: Database, id: string) {
  const [event] = await database
    .delete(propertyEvents)
    .where(eq(propertyEvents.id, id))
    .returning(eventProjection);
  if (!event) throw notFound("History entry not found.");
  return event;
}
export function listDocuments(database: Database, propertyId: string) {
  return database
    .select(documentProjection)
    .from(documents)
    .where(eq(documents.propertyId, propertyId))
    .orderBy(desc(documents.documentDate), desc(documents.createdAt));
}
export async function requireDocument(database: Database, id: string) {
  const [document] = await database
    .select(documentProjection)
    .from(documents)
    .where(eq(documents.id, id));
  if (!document) throw notFound("Document not found.");
  return document;
}
export async function insertDocument(
  database: Database,
  input: typeof documents.$inferInsert,
) {
  const [document] = await database
    .insert(documents)
    .values(input)
    .returning(documentProjection);
  return document!;
}
export async function updateDocument(
  database: Database,
  id: string,
  input: z.infer<typeof documentMetadataSchema>,
) {
  input = documentMetadataSchema.parse(input);
  const existing = await requireDocument(database, id);
  await requireEvent(database, existing.propertyId, input.eventId);
  const [document] = await database
    .update(documents)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(documents.id, id))
    .returning(documentProjection);
  return document!;
}
export async function deleteDocument(database: Database, id: string) {
  await database.delete(documents).where(eq(documents.id, id));
}
