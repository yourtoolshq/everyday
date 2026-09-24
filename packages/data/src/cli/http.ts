import http from "node:http";
import https from "node:https";

export class ApplicationUnreachableError extends Error {
  override name = "ApplicationUnreachableError";
}

export class DataRequestError extends Error {
  override name = "DataRequestError";
}

interface TrpcEnvelope {
  result?: { data: unknown };
  error?: { message: string };
}

// node:http has no response timeout by default, so a restore of a large archive is not
// cut off while the application works on it.
export function callProcedure<T>(
  baseUrl: string,
  procedure: string,
  input?: unknown,
): Promise<T> {
  const url = new URL(`/api/data/trpc/${procedure}`, baseUrl);
  const body = input === undefined ? undefined : JSON.stringify(input);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: body === undefined ? "GET" : "POST",
        headers:
          body === undefined ? {} : { "content-type": "application/json" },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let envelope: TrpcEnvelope;
          try {
            envelope = JSON.parse(text) as TrpcEnvelope;
          } catch {
            reject(
              new DataRequestError(
                `${url.href} answered ${response.statusCode} without a data response; is it the right application?`,
              ),
            );
            return;
          }
          if (envelope.error) {
            reject(new DataRequestError(envelope.error.message));
          } else {
            resolve(envelope.result?.data as T);
          }
        });
      },
    );
    request.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ECONNREFUSED"
          ? new ApplicationUnreachableError(
              `Nothing is listening at ${baseUrl}`,
            )
          : error,
      );
    });
    request.end(body);
  });
}
