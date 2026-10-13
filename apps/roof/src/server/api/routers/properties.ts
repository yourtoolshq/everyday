import { z } from "zod";

import { fileToken } from "@yourtoolshq/data/files";

import { mapAppErrors } from "~/core/infrastructure/trpc-errors";
import { documentMetadataSchema } from "~/lib/documents";
import { eventFieldsSchema } from "~/lib/events";
import { insuranceFieldsSchema } from "~/lib/insurance";
import { leaseFieldsSchema } from "~/lib/leases";
import { propertyFieldsSchema } from "~/lib/properties";
import {
  attachDocument,
  removeDocument,
  saveProperty,
} from "~/modules/properties/operations";
import * as repository from "~/modules/properties/repository";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const photoInput = z.object({
  photo: fileToken("propertyPhoto").nullable().optional(),
});
const idInput = z.object({ id: z.string().uuid() });
const propertyInput = z.object({ propertyId: z.string().uuid() });
export const propertiesRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) =>
    mapAppErrors(() => repository.listProperties(ctx.db)),
  ),
  detail: publicProcedure.input(idInput).query(({ ctx, input }) =>
    mapAppErrors(async () => {
      const property = await repository.requireProperty(ctx.db, input.id);
      const [events, documents, insurance, leases] = await Promise.all([
        repository.listEvents(ctx.db, input.id),
        repository.listDocuments(ctx.db, input.id),
        repository.listInsurance(ctx.db, input.id),
        repository.listLeases(ctx.db, input.id),
      ]);
      return { property, events, documents, insurance, leases };
    }),
  ),
  create: publicProcedure
    .input(propertyFieldsSchema.and(photoInput))
    .mutation(({ ctx, input }) => mapAppErrors(() => saveProperty(ctx, input))),
  update: publicProcedure
    .input(propertyFieldsSchema.and(idInput).and(photoInput))
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => saveProperty(ctx, input, input.id)),
    ),
  saveLease: publicProcedure
    .input(
      leaseFieldsSchema.and(z.object({ id: z.string().uuid().optional() })),
    )
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => repository.saveLease(ctx.db, input, input.id)),
    ),
  deleteLease: publicProcedure
    .input(idInput)
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => repository.deleteLease(ctx.db, input.id)),
    ),
  saveInsurance: publicProcedure
    .input(
      insuranceFieldsSchema.and(z.object({ id: z.string().uuid().optional() })),
    )
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => repository.saveInsurance(ctx.db, input, input.id)),
    ),
  deleteInsurance: publicProcedure
    .input(idInput)
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => repository.deleteInsurance(ctx.db, input.id)),
    ),
  saveEvent: publicProcedure
    .input(eventFieldsSchema.extend({ id: z.string().uuid().optional() }))
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => repository.saveEvent(ctx.db, input, input.id)),
    ),
  deleteEvent: publicProcedure
    .input(idInput)
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => repository.deleteEvent(ctx.db, input.id)),
    ),
  attachDocument: publicProcedure
    .input(
      documentMetadataSchema
        .and(propertyInput)
        .and(z.object({ file: fileToken("document") })),
    )
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => attachDocument(ctx, input)),
    ),
  updateDocument: publicProcedure
    .input(documentMetadataSchema.and(idInput))
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => repository.updateDocument(ctx.db, input.id, input)),
    ),
  deleteDocument: publicProcedure
    .input(idInput)
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => removeDocument(ctx, input.id)),
    ),
});
