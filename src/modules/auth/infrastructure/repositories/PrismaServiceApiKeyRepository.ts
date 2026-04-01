import type { PrismaClient } from "@prisma/client";
import type {
  ServiceApiKeyRecord,
  ServiceApiKeyRepository
} from "../../domain/repositories/ServiceApiKeyRepository.js";

export class PrismaServiceApiKeyRepository implements ServiceApiKeyRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findActiveByKeyId(keyId: string): Promise<ServiceApiKeyRecord | null> {
    const row = await this.prisma.serviceApiKey.findFirst({
      where: {
        keyId,
        enabled: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        revokedAt: null
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }]
    });

    if (!row) {
      return null;
    }

    return {
      keyId: row.keyId,
      secret: row.secret,
      enabled: row.enabled,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt
    };
  }
}
