/**
 * Minimal structured server logger for container stdout/stderr.
 *
 * Only pass allow-listed safe context. Never log names, document contents,
 * tokens, raw requests, uploaded filenames, or unrestricted database rows.
 */

export type LogLevel = "info" | "warn" | "error";

export type SafeLogValue = string | number | boolean | null;

export type SafeLogContext = Readonly<Record<string, SafeLogValue | undefined>>;

export type LogEvent = {
  level: LogLevel;
  /** Application or package identity (e.g. tenure, taxbook, data). */
  app: string;
  /** Stable operation name (e.g. paycheck.create, backup.create). */
  operation: string;
  outcome?: "success" | "failure";
  durationMs?: number;
  message?: string;
} & SafeLogContext;

function sink(level: LogLevel, line: string) {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Emit one structured JSON log line. */
export function logEvent(event: LogEvent) {
  const { level, app, operation, outcome, durationMs, message, ...context } =
    event;
  const payload: Record<string, SafeLogValue> = {
    ts: new Date().toISOString(),
    level,
    app,
    operation,
  };
  if (outcome !== undefined) payload.outcome = outcome;
  if (durationMs !== undefined) payload.durationMs = durationMs;
  if (message !== undefined) payload.message = message;
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) payload[key] = value;
  }
  sink(level, JSON.stringify(payload));
}

export interface Logger {
  info: (
    operation: string,
    context?: SafeLogContext & {
      outcome?: "success" | "failure";
      durationMs?: number;
      message?: string;
    },
  ) => void;
  warn: (
    operation: string,
    context?: SafeLogContext & {
      outcome?: "success" | "failure";
      durationMs?: number;
      message?: string;
    },
  ) => void;
  error: (
    operation: string,
    context?: SafeLogContext & {
      outcome?: "success" | "failure";
      durationMs?: number;
      message?: string;
    },
  ) => void;
}

export function createLogger(app: string): Logger {
  const write =
    (level: LogLevel) =>
    (
      operation: string,
      context?: SafeLogContext & {
        outcome?: "success" | "failure";
        durationMs?: number;
        message?: string;
      },
    ) => {
      logEvent({ level, app, operation, ...context });
    };

  return {
    info: write("info"),
    warn: write("warn"),
    error: write("error"),
  };
}
