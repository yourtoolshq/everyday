import { asc, eq } from "drizzle-orm";

import { conflict, notFound, unexpected } from "@yourtoolshq/server/errors";

import type {
  CreateInstrumentCommand,
  InstrumentDto,
  UpdateInstrumentCommand,
} from "~/modules/investments/domain/instrument-dto";
import type { db as passbookDb } from "~/server/db";
import { normalizeInstrumentCommand } from "~/modules/investments/domain/instrument-dto";
import {
  investmentInstrumentIdentifiers,
  investmentInstruments,
} from "~/server/db/schema";

export type PassbookDatabase = Pick<
  typeof passbookDb,
  "select" | "insert" | "update" | "delete" | "transaction"
>;

const now = () => new Date().toISOString();

async function loadInstrumentDto(
  db: Pick<PassbookDatabase, "select">,
  instrumentId: string,
): Promise<InstrumentDto | null> {
  const [instrument] = await db
    .select()
    .from(investmentInstruments)
    .where(eq(investmentInstruments.id, instrumentId));
  if (!instrument) return null;
  const identifiers = await db
    .select()
    .from(investmentInstrumentIdentifiers)
    .where(eq(investmentInstrumentIdentifiers.instrumentId, instrumentId))
    .orderBy(asc(investmentInstrumentIdentifiers.kind));
  return {
    id: instrument.id,
    displayName: instrument.displayName,
    kind: instrument.kind,
    series: instrument.series,
    notes: instrument.notes,
    identifiers: identifiers.map((row) => ({
      id: row.id,
      kind: row.kind,
      value: row.value,
      namespace: row.namespace,
    })),
  };
}

export function createInstrumentRepository(db: PassbookDatabase) {
  return {
    async list(): Promise<InstrumentDto[]> {
      const instruments = await db
        .select()
        .from(investmentInstruments)
        .orderBy(asc(investmentInstruments.displayName));
      const identifiers = await db
        .select()
        .from(investmentInstrumentIdentifiers)
        .orderBy(asc(investmentInstrumentIdentifiers.kind));
      const identifiersByInstrument = new Map<
        string,
        (typeof identifiers)[number][]
      >();
      for (const row of identifiers) {
        const list = identifiersByInstrument.get(row.instrumentId) ?? [];
        list.push(row);
        identifiersByInstrument.set(row.instrumentId, list);
      }
      return instruments.map((instrument) => ({
        id: instrument.id,
        displayName: instrument.displayName,
        kind: instrument.kind,
        series: instrument.series,
        notes: instrument.notes,
        identifiers: (identifiersByInstrument.get(instrument.id) ?? []).map(
          (row) => ({
            id: row.id,
            kind: row.kind,
            value: row.value,
            namespace: row.namespace,
          }),
        ),
      }));
    },

    async create(command: CreateInstrumentCommand): Promise<InstrumentDto> {
      const normalized = normalizeInstrumentCommand(command);
      return db.transaction(async (tx) => {
        const [instrument] = await tx
          .insert(investmentInstruments)
          .values({
            displayName: normalized.displayName,
            kind: normalized.kind,
            series: normalized.series,
            notes: normalized.notes,
          })
          .returning();
        if (!instrument) throw unexpected("Instrument creation failed.");

        if (normalized.identifiers.length > 0) {
          try {
            await tx.insert(investmentInstrumentIdentifiers).values(
              normalized.identifiers.map((identifier) => ({
                instrumentId: instrument.id,
                kind: identifier.kind,
                value: identifier.value,
                namespace: identifier.namespace,
              })),
            );
          } catch {
            throw conflict(
              "An instrument with one of these identifiers already exists.",
            );
          }
        }

        const loaded = await loadInstrumentDto(tx, instrument.id);
        if (!loaded) throw unexpected("Instrument could not be loaded.");
        return loaded;
      });
    },

    async updateInTransaction(command: UpdateInstrumentCommand): Promise<{
      instrument: InstrumentDto;
      previous: {
        kind: CreateInstrumentCommand["kind"];
        series: string | null;
        identifiers: CreateInstrumentCommand["identifiers"];
      };
    }> {
      const normalized = normalizeInstrumentCommand(command);
      const [existing] = await db
        .select()
        .from(investmentInstruments)
        .where(eq(investmentInstruments.id, command.id));
      if (!existing) throw notFound("Instrument not found.");

      const existingIdentifiers = await db
        .select()
        .from(investmentInstrumentIdentifiers)
        .where(eq(investmentInstrumentIdentifiers.instrumentId, command.id));

      await db
        .update(investmentInstruments)
        .set({
          displayName: normalized.displayName,
          kind: normalized.kind,
          series: normalized.series,
          notes: normalized.notes,
          updatedAt: now(),
        })
        .where(eq(investmentInstruments.id, command.id));

      await db
        .delete(investmentInstrumentIdentifiers)
        .where(eq(investmentInstrumentIdentifiers.instrumentId, command.id));

      if (normalized.identifiers.length > 0) {
        try {
          await db.insert(investmentInstrumentIdentifiers).values(
            normalized.identifiers.map((identifier) => ({
              instrumentId: command.id,
              kind: identifier.kind,
              value: identifier.value,
              namespace: identifier.namespace,
            })),
          );
        } catch {
          throw conflict(
            "An instrument with one of these identifiers already exists.",
          );
        }
      }

      const loaded = await loadInstrumentDto(db, command.id);
      if (!loaded) throw unexpected("Instrument could not be loaded.");
      return {
        instrument: loaded,
        previous: {
          kind: existing.kind,
          series: existing.series,
          identifiers: existingIdentifiers.map((row) => ({
            kind: row.kind,
            value: row.value,
            namespace: row.namespace,
          })),
        },
      };
    },

    async update(command: UpdateInstrumentCommand): Promise<{
      instrument: InstrumentDto;
      previous: {
        kind: CreateInstrumentCommand["kind"];
        series: string | null;
        identifiers: CreateInstrumentCommand["identifiers"];
      };
    }> {
      return db.transaction(async (tx) =>
        createInstrumentRepository(tx as PassbookDatabase).updateInTransaction(
          command,
        ),
      );
    },

    async get(id: string): Promise<InstrumentDto | null> {
      return loadInstrumentDto(db, id);
    },
  };
}

export type InstrumentRepository = ReturnType<
  typeof createInstrumentRepository
>;
