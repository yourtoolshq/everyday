import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { validateDocumentClaimLink, type DocumentType } from "~/lib/documents";
import { claims } from "~/server/db/schema";

export async function resolveDocumentClaimId(
  db: typeof import("~/server/db").db,
  visitId: string,
  type: DocumentType,
  claimId: string | null | undefined,
): Promise<string | null> {
  const normalizedClaimId = claimId ?? null;
  const linkError = validateDocumentClaimLink(type, normalizedClaimId);
  if (linkError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: linkError });
  }
  if (!normalizedClaimId) return null;

  const [claim] = await db
    .select({ visitId: claims.visitId })
    .from(claims)
    .where(eq(claims.id, normalizedClaimId));
  if (!claim) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Claim not found" });
  }
  if (claim.visitId !== visitId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The claim must belong to the same visit as the document.",
    });
  }
  return normalizedClaimId;
}
