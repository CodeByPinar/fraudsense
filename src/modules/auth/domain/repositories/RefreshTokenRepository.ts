import type { RefreshTokenRecord } from "../types.js";

export interface RefreshTokenRepository {
  save(record: RefreshTokenRecord): Promise<void>;
  findByTokenId(tokenId: string): Promise<RefreshTokenRecord | null>;
  revoke(tokenId: string, replacedByTokenId: string | null): Promise<void>;
}
