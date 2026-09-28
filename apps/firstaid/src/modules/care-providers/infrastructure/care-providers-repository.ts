import { asc, count } from "drizzle-orm";

import { unexpected } from "@yourtoolshq/server/errors";

import type { CreateCareOrganizationCommand } from "~/modules/care-providers/domain/care-organization-values";
import type { db as firstaidDb } from "~/server/db";
import { careOrganizations, providers, visits } from "~/server/db/schema";

export type FirstAidDatabase = typeof firstaidDb;

export type CareOrganizationRecord = {
  id: string;
  name: string;
  phoneNumbers: string[];
  websiteUrl: string | null;
  bookingUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderRecord = {
  id: string;
  name: string;
  careOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
};

const organizationColumns = {
  id: careOrganizations.id,
  name: careOrganizations.name,
  phoneNumbers: careOrganizations.phoneNumbers,
  websiteUrl: careOrganizations.websiteUrl,
  bookingUrl: careOrganizations.bookingUrl,
  createdAt: careOrganizations.createdAt,
  updatedAt: careOrganizations.updatedAt,
} as const;

const providerColumns = {
  id: providers.id,
  name: providers.name,
  careOrganizationId: providers.careOrganizationId,
  createdAt: providers.createdAt,
  updatedAt: providers.updatedAt,
} as const;

export function createCareProvidersRepository(db: FirstAidDatabase) {
  return {
    async listOrganizations(): Promise<CareOrganizationRecord[]> {
      return db
        .select(organizationColumns)
        .from(careOrganizations)
        .orderBy(asc(careOrganizations.name));
    },

    async listProviders(): Promise<ProviderRecord[]> {
      return db
        .select(providerColumns)
        .from(providers)
        .orderBy(asc(providers.name));
    },

    async countVisitsByOrganization(): Promise<
      Array<{ id: string | null; total: number }>
    > {
      return db
        .select({ id: visits.careOrganizationId, total: count() })
        .from(visits)
        .groupBy(visits.careOrganizationId);
    },

    async countVisitsByProvider(): Promise<
      Array<{ id: string | null; total: number }>
    > {
      return db
        .select({ id: visits.providerId, total: count() })
        .from(visits)
        .groupBy(visits.providerId);
    },

    async createOrganization(
      command: CreateCareOrganizationCommand,
    ): Promise<CareOrganizationRecord> {
      const [organization] = await db
        .insert(careOrganizations)
        .values(command)
        .returning(organizationColumns);
      if (!organization) {
        throw unexpected("Care organization creation failed.");
      }
      return organization;
    },
  };
}

export type CareProvidersRepository = ReturnType<
  typeof createCareProvidersRepository
>;
