import type { PrismaClient } from "@prisma/client";
import type { FraudRuleRepository } from "../../domain/repositories/FraudRuleRepository.js";
import type { RuleConfigRecord, RuleThresholdConfig } from "../../domain/types.js";

export class PrismaFraudRuleRepository implements FraudRuleRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getEnabledRules(): Promise<RuleConfigRecord[]> {
    const rows = await this.prisma.fraudRule.findMany({
      where: { enabled: true },
      orderBy: { weight: "desc" }
    });

    return rows.map((row: {
      name: string;
      enabled: boolean;
      weight: number;
      conditions: unknown;
    }) => ({
      name: row.name,
      enabled: row.enabled,
      weight: row.weight,
      conditions:
        typeof row.conditions === "object" && row.conditions !== null
          ? (row.conditions as Record<string, unknown>)
          : {}
    }));
  }

  public async getThresholdConfig(): Promise<RuleThresholdConfig> {
    const row = await this.prisma.riskThreshold.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!row) {
      return {
        reviewThreshold: 40,
        blockThreshold: 75,
        earlyExitScore: 95,
        multiTriggerBoost: 0.2
      };
    }

    return {
      reviewThreshold: row.reviewThreshold,
      blockThreshold: row.blockThreshold,
      earlyExitScore: row.earlyExitScore,
      multiTriggerBoost: Number(row.multiTriggerBoost)
    };
  }
}
