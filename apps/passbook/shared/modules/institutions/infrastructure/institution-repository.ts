import { asc } from "drizzle-orm";

import { unexpected } from "@yourtoolshq/server/errors";

import type { CreateInstitutionCommand } from "~/modules/institutions/domain/institution-values";
import type { db as passbookDb } from "~/server/db";
import { normalizeInstitutionCommand } from "~/modules/institutions/domain/institution-values";
import { institutions } from "~/server/db/schema";

export type PassbookDatabase = Pick<typeof passbookDb, "select" | "insert">;

export interface InstitutionRecord {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  iconFileId: string | null;
  createdAt: string;
  updatedAt: string;
}

const institutionColumns = {
  id: institutions.id,
  name: institutions.name,
  website: institutions.website,
  notes: institutions.notes,
  iconFileId: institutions.iconFileId,
  createdAt: institutions.createdAt,
  updatedAt: institutions.updatedAt,
} as const;

export function createInstitutionRepository(db: PassbookDatabase) {
  return {
    async list(): Promise<InstitutionRecord[]> {
      return db
        .select(institutionColumns)
        .from(institutions)
        .orderBy(asc(institutions.name));
    },

    async create(
      command: CreateInstitutionCommand,
    ): Promise<InstitutionRecord> {
      const values = normalizeInstitutionCommand(command);
      const [institution] = await db
        .insert(institutions)
        .values(values)
        .returning(institutionColumns);
      if (!institution) {
        throw unexpected("Institution creation failed.");
      }
      return institution;
    },
  };
}

export type InstitutionRepository = ReturnType<
  typeof createInstitutionRepository
>;
