import type {
  ServiceApiKeyRecord,
  ServiceApiKeyRepository
} from "../../domain/repositories/ServiceApiKeyRepository.js";

export class InMemoryServiceApiKeyRepository implements ServiceApiKeyRepository {
  private readonly records: ServiceApiKeyRecord[];

  public constructor(map: Record<string, string>) {
    this.records = Object.entries(map).map(([keyId, secret]) => ({
      keyId,
      secret,
      enabled: true,
      expiresAt: null,
      revokedAt: null
    }));
  }

  public async findActiveByKeyId(keyId: string): Promise<ServiceApiKeyRecord | null> {
    const record = this.records.find((item) => item.keyId === keyId);
    if (!record) {
      return null;
    }

    const now = Date.now();
    const expired = record.expiresAt ? record.expiresAt.getTime() < now : false;
    const revoked = record.revokedAt !== null;
    if (!record.enabled || expired || revoked) {
      return null;
    }

    return record;
  }
}
