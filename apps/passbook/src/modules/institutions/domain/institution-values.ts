export type CreateInstitutionCommand = {
  name: string;
  website?: string | null;
  notes?: string | null;
};

export function normalizeInstitutionCommand(input: CreateInstitutionCommand) {
  return {
    name: input.name,
    website: input.website ?? null,
    notes: input.notes ?? null,
  };
}
