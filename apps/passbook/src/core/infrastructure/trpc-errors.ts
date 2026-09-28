import { TRPCError } from "@trpc/server";

import type { AppErrorCode } from "@yourtoolshq/server/errors";
import { isAppError } from "@yourtoolshq/server/errors";

const trpcCodeByAppCode: Record<AppErrorCode, TRPCError["code"]> = {
  invalid_input: "BAD_REQUEST",
  not_found: "NOT_FOUND",
  conflict: "CONFLICT",
  failed_precondition: "PRECONDITION_FAILED",
  unexpected: "INTERNAL_SERVER_ERROR",
};

export function toTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  if (isAppError(error)) {
    return new TRPCError({
      code: trpcCodeByAppCode[error.code],
      message: error.message,
      cause: error,
    });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong.",
    cause: error,
  });
}

export async function mapAppErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toTRPCError(error);
  }
}
