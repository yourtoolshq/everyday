import { invalidInput } from "@yourtoolshq/server/errors";

import type {
  IdentifierKind,
  InstrumentKind,
} from "~/modules/investments/domain/enums";
import {
  identifierKinds,
  instrumentKinds,
} from "~/modules/investments/domain/enums";

export interface IdentifierInput {
  kind: IdentifierKind;
  value: string;
  namespace: string | null;
}

export interface InstrumentDto {
  id: string;
  displayName: string;
  kind: InstrumentKind;
  series: string | null;
  notes: string | null;
  identifiers: IdentifierDto[];
}

export interface IdentifierDto extends IdentifierInput {
  id?: string;
}

export interface CreateInstrumentCommand {
  displayName: string;
  kind: InstrumentKind;
  series: string | null;
  notes: string | null;
  identifiers: IdentifierInput[];
}

export interface UpdateInstrumentCommand extends CreateInstrumentCommand {
  id: string;
}

export function normalizeIdentifierValue(kind: IdentifierKind, value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw invalidInput("Identifier value cannot be empty.");
  }
  if (kind === "ticker" || kind === "fund_code") {
    return trimmed.toUpperCase();
  }
  return trimmed.toUpperCase();
}

export function normalizeInstrumentCommand(
  command: CreateInstrumentCommand,
): CreateInstrumentCommand {
  const displayName = command.displayName.trim();
  if (!displayName) {
    throw invalidInput("Instrument name is required.");
  }
  if (!instrumentKinds.includes(command.kind)) {
    throw invalidInput("Instrument kind is invalid.");
  }
  const series = command.series?.trim() || null;
  if (command.kind === "mutual_fund" && !series) {
    throw invalidInput("Mutual funds need an explicit series.");
  }

  const seen = new Set<string>();
  const identifiers = command.identifiers.map((identifier) => {
    if (!identifierKinds.includes(identifier.kind)) {
      throw invalidInput("Identifier kind is invalid.");
    }
    const value = normalizeIdentifierValue(identifier.kind, identifier.value);
    const namespace = identifier.namespace?.trim() || null;
    const key = `${identifier.kind}:${namespace ?? ""}:${value}`;
    if (seen.has(key)) {
      throw invalidInput("Duplicate identifiers are not allowed.");
    }
    seen.add(key);
    return {
      kind: identifier.kind,
      value,
      namespace,
    };
  });

  return {
    displayName,
    kind: command.kind,
    series,
    notes: command.notes?.trim() || null,
    identifiers,
  };
}

export function identifiersAreIdentityRelevantChange(
  before: IdentifierInput[],
  after: IdentifierInput[],
): boolean {
  const normalize = (rows: IdentifierInput[]) =>
    rows
      .map(
        (row) =>
          `${row.kind}:${row.namespace ?? ""}:${normalizeIdentifierValue(row.kind, row.value)}`,
      )
      .sort()
      .join("|");
  return normalize(before) !== normalize(after);
}

export function instrumentIdentityRelevantChange(
  before: Pick<CreateInstrumentCommand, "kind" | "series" | "identifiers">,
  after: Pick<CreateInstrumentCommand, "kind" | "series" | "identifiers">,
): boolean {
  if (before.kind !== after.kind) return true;
  if ((before.series ?? "") !== (after.series ?? "")) return true;
  return identifiersAreIdentityRelevantChange(
    before.identifiers,
    after.identifiers,
  );
}
