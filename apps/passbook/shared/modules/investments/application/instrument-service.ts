import type {
  CreateInstrumentCommand,
  UpdateInstrumentCommand,
} from "~/modules/investments/domain/instrument-dto";
import type {
  InstrumentRepository,
  PassbookDatabase,
} from "~/modules/investments/infrastructure/instrument-repository";
import { createInvestmentStatementRepository } from "~/modules/investment-statements/infrastructure/investment-statement-repository";
import { instrumentIdentityRelevantChange } from "~/modules/investments/domain/instrument-dto";
import { createInstrumentRepository } from "~/modules/investments/infrastructure/instrument-repository";

export async function listInstruments(repository: InstrumentRepository) {
  return repository.list();
}

export async function getInstrument(
  repository: InstrumentRepository,
  id: string,
) {
  return repository.get(id);
}

export async function createInstrument(
  repository: InstrumentRepository,
  command: CreateInstrumentCommand,
) {
  return repository.create(command);
}

export async function updateInstrument(
  db: PassbookDatabase,
  command: UpdateInstrumentCommand,
) {
  return db.transaction(async (tx) => {
    const instrumentRepository = createInstrumentRepository(
      tx as PassbookDatabase,
    );
    const investmentRepository = createInvestmentStatementRepository(
      tx as PassbookDatabase,
    );
    const { instrument, previous } =
      await instrumentRepository.updateInTransaction(command);

    if (
      instrumentIdentityRelevantChange(
        {
          kind: previous.kind,
          series: previous.series,
          identifiers: previous.identifiers,
        },
        command,
      )
    ) {
      await investmentRepository.invalidateReviewedSnapshotsForInstruments([
        command.id,
      ]);
    }

    return instrument;
  });
}
