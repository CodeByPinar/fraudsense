import type { PrismaClient } from "@prisma/client";
import type { RefreshTokenRepository } from "../../domain/repositories/RefreshTokenRepository.js";
import type { RefreshTokenRecord } from "../../domain/types.js";

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async save(record: RefreshTokenRecord): Promise<void> {
    await this.prisma.refreshToken.upsert({
      where: { tokenId: record.tokenId },
      create: {
        tokenId: record.tokenId,
        userId: record.userId,
        tokenHash: record.tokenHash,
        expiresAt: record.expiresAt,
        revokedAt: record.revokedAt,
        replacedByTokenId: record.replacedByTokenId
      },
      update: {
        tokenHash: record.tokenHash,
        expiresAt: record.expiresAt,
        revokedAt: record.revokedAt,
        replacedByTokenId: record.replacedByTokenId
      }
    });
  }

  public async findByTokenId(tokenId: string): Promise<RefreshTokenRecord | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenId } });
    if (!row) {
      return null;
    }

    return {
      tokenId: row.tokenId,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      replacedByTokenId: row.replacedByTokenId
    };
  }

  public async revoke(tokenId: string, replacedByTokenId: string | null): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date(),
        replacedByTokenId
      }
    });
  }
}
