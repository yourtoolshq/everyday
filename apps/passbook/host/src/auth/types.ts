export interface AuthTokenRecord {
  id: string;
  hash: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PairingCodeRecord {
  code: string;
  expiresAt: string;
}

export interface AuthStoreData {
  tokens: AuthTokenRecord[];
  pairingCodes: PairingCodeRecord[];
}

export interface AuthContext {
  remoteAddress: string;
  isLoopback: boolean;
  tokenId: string | null;
}
