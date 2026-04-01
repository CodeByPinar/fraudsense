export interface ServiceApiKeyRecord {
  keyId: string;
  secret: string;
  enabled: boolean;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface ServiceApiKeyRepository {
  findActiveByKeyId(keyId: string): Promise<ServiceApiKeyRecord | null>;
}
