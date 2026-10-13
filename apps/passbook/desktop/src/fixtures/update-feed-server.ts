import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Server } from "node:http";

export interface UpdateFeedArtifact {
  payload: Buffer;
  sha512: string;
  version: string;
}

export function buildUpdateArtifact(
  version: string,
  body = Buffer.from(`passbook-simulated-update-${version}\n`),
): UpdateFeedArtifact {
  const sha512 = createHash("sha512").update(body).digest("base64");
  return { payload: body, sha512, version };
}

export interface UpdateFeedServer {
  baseUrl: string;
  artifact: UpdateFeedArtifact;
  setCorruptTransfer: (enabled: boolean) => void;
  close: () => Promise<void>;
}

export async function startUpdateFeedServer(
  artifact: UpdateFeedArtifact,
): Promise<UpdateFeedServer> {
  let server: Server | null = null;
  let corruptTransfer = false;
  const baseUrl = await new Promise<string>((resolve, reject) => {
    server = createServer((request, response) => {
      const path = request.url ?? "/";
      if (path === "/artifact") {
        const payload = corruptTransfer
          ? Buffer.from("simulated corrupted update bytes on the wire\n")
          : artifact.payload;
        response.writeHead(200, { "content-type": "application/octet-stream" });
        response.end(payload);
        return;
      }
      if (path === "/latest.yml" || path === "/latest-mac.yml") {
        const yaml = [
          `version: ${artifact.version}`,
          "files:",
          `  - url: artifact`,
          `    sha512: ${artifact.sha512}`,
          "path: artifact",
          `sha512: ${artifact.sha512}`,
          "",
        ].join("\n");
        response.writeHead(200, { "content-type": "text/yaml" });
        response.end(yaml);
        return;
      }
      response.writeHead(404);
      response.end("not found");
    });
    const boundServer = server;
    boundServer.listen(0, "127.0.0.1", () => {
      const address = boundServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not bind update feed server"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
    server.on("error", reject);
  });

  return {
    baseUrl,
    artifact,
    setCorruptTransfer: (enabled: boolean) => {
      corruptTransfer = enabled;
    },
    close: () =>
      new Promise((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
