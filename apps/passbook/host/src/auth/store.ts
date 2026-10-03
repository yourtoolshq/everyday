import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { dirname, join } from "node:path";

import type { AuthStoreData, AuthTokenRecord, PairingCodeRecord } from "./types";

const PAIRING_TTL_MS = 5 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return randomBytes(32).toString("base64url");
}

function generatePairingCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export class AuthStore {
  private data: AuthStoreData = { tokens: [], pairingCodes: [] };
  private loaded = false;

  constructor(private readonly filePath: string) {}

  private async ensureLoaded() {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.data = JSON.parse(raw) as AuthStoreData;
    } catch {
      this.data = { tokens: [], pairingCodes: [] };
    }
    this.loaded = true;
  }

  private async persist() {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  private pruneExpiredCodes() {
    const now = Date.now();
    this.data.pairingCodes = this.data.pairingCodes.filter(
      (entry) => Date.parse(entry.expiresAt) > now,
    );
  }

  async createPairingCode() {
    await this.ensureLoaded();
    this.pruneExpiredCodes();
    const code = generatePairingCode();
    const record: PairingCodeRecord = {
      code,
      expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
    };
    this.data.pairingCodes.push(record);
    await this.persist();
    return record;
  }

  async pairDevice(input: { code: string; label: string }) {
    await this.ensureLoaded();
    this.pruneExpiredCodes();
    const index = this.data.pairingCodes.findIndex(
      (entry) => entry.code === input.code,
    );
    if (index === -1) {
      throw new Error("Invalid or expired pairing code.");
    }
    this.data.pairingCodes.splice(index, 1);

    const token = generateToken();
    const record: AuthTokenRecord = {
      id: randomBytes(8).toString("hex"),
      hash: hashToken(token),
      label: input.label.trim() || "Paired device",
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
    this.data.tokens.push(record);
    await this.persist();
    return { token, id: record.id, label: record.label };
  }

  async verifyToken(token: string | null) {
    if (!token) return null;
    await this.ensureLoaded();
    const hash = hashToken(token);
    const record = this.data.tokens.find((entry) => entry.hash === hash);
    if (!record) return null;
    record.lastUsedAt = new Date().toISOString();
    await this.persist();
    return record.id;
  }

  async listTokens() {
    await this.ensureLoaded();
    return this.data.tokens.map(({ id, label, createdAt, lastUsedAt }) => ({
      id,
      label,
      createdAt,
      lastUsedAt,
    }));
  }

  async revokeToken(id: string) {
    await this.ensureLoaded();
    const before = this.data.tokens.length;
    this.data.tokens = this.data.tokens.filter((entry) => entry.id !== id);
    if (this.data.tokens.length === before) {
      throw new Error("Token not found.");
    }
    await this.persist();
  }
}

export function createAuthStore(dataDir: string) {
  return new AuthStore(join(dataDir, "auth", "clients.json"));
}
