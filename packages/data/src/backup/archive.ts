import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { extract, pack } from "tar-stream";

export interface Digest {
  size: number;
  sha256: string;
}

export interface ArchiveWriter {
  addFile: (name: string, sourcePath: string) => Promise<Digest>;
  addJson: (name: string, value: unknown) => Promise<void>;
}

export interface ArchiveEntry {
  name: string;
  type: string;
  stream: Readable;
}

export async function digestInto(
  source: Readable,
  destination?: Writable,
): Promise<Digest> {
  const hash = createHash("sha256");
  let size = 0;
  const tap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      size += chunk.byteLength;
      callback(null, chunk);
    },
  });
  const sink =
    destination ??
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
  await pipeline(source, tap, sink);
  return { size, sha256: hash.digest("hex") };
}

export async function writeArchive(
  path: string,
  write: (archive: ArchiveWriter) => Promise<void>,
) {
  const tarball = pack();
  const output = pipeline(tarball, createWriteStream(path, { flags: "wx" }));
  try {
    await write({
      async addFile(name, sourcePath) {
        const { size } = await stat(sourcePath);
        // tar-stream's streamx streams interoperate with node:stream pipelines at runtime.
        const sink = tarball.entry({ name, size, mode: 0o600 });
        return digestInto(
          createReadStream(sourcePath),
          sink as unknown as Writable,
        );
      },
      addJson(name, value) {
        const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
        return new Promise((resolve, reject) =>
          tarball.entry({ name, mode: 0o600 }, bytes, (error) =>
            error ? reject(error) : resolve(),
          ),
        );
      },
    });
    tarball.finalize();
    await output;
  } catch (error) {
    tarball.destroy();
    await output.catch(() => undefined);
    throw error;
  }
}

// Entries are read in order; each handler must consume its stream before returning.
export async function readArchive(
  path: string,
  onEntry: (entry: ArchiveEntry) => Promise<void>,
) {
  const tarball = extract();
  const input = pipeline(createReadStream(path), tarball);
  try {
    for await (const entry of tarball) {
      await onEntry({
        name: entry.header.name,
        type: entry.header.type,
        stream: entry as unknown as Readable,
      });
      entry.resume();
    }
    await input;
  } catch (error) {
    tarball.destroy();
    await input.catch(() => undefined);
    throw error;
  }
}
