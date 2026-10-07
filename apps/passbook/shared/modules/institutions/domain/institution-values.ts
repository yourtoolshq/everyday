export interface CreateInstitutionCommand {
  name: string;
  website?: string | null;
  notes?: string | null;
  iconFileId?: string | null;
}

export function normalizeInstitutionCommand(input: CreateInstitutionCommand) {
  return {
    name: input.name,
    website: input.website ?? null,
    notes: input.notes ?? null,
    iconFileId: input.iconFileId ?? null,
  };
}
