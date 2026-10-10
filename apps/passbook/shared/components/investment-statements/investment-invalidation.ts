import { api } from "~/trpc/react";

type Utils = ReturnType<typeof api.useUtils>;

export async function invalidateInvestmentCaches(
  utils: Utils,
  options: { documentId: string; accountId: string },
) {
  await Promise.all([
    utils.investmentStatements.getByDocument.invalidate({
      documentId: options.documentId,
    }),
    utils.investmentStatements.listByAccount.invalidate({
      accountId: options.accountId,
    }),
    utils.investmentInstruments.holdings.invalidate(),
    utils.investmentInstruments.list.invalidate(),
  ]);
}

export function isConflictError(error: {
  data?: { code?: string } | null;
}): boolean {
  return error.data?.code === "CONFLICT";
}
