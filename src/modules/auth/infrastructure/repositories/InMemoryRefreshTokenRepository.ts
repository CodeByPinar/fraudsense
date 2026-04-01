import type { RefreshTokenRepository } from "../../domain/repositories/RefreshTokenRepository.js";
import type { RefreshTokenRecord } from "../../domain/types.js";

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly storage = new Map<string, RefreshTokenRecord>();

  public async save(record: RefreshTokenRecord): Promise<void> {
    this.storage.set(record.tokenId, record);
  }

  public async findByTokenId(tokenId: string): Promise<RefreshTokenRecord | null> {
    return this.storage.get(tokenId) ?? null;
  }

  public async revoke(tokenId: string, replacedByTokenId: string | null): Promise<void> {
    const existing = this.storage.get(tokenId);
    if (!existing) {
      return;
    }

    this.storage.set(tokenId, {
      ...existing,
      revokedAt: new Date(),
      replacedByTokenId
    });
  }
}
