import { DEFAULT_EARLY_EXIT_SCORE } from "../../../../shared/constants/risk.js";
import type { FraudRuleRepository } from "../../domain/repositories/FraudRuleRepository.js";
import type { RuleConfigRecord, RuleThresholdConfig } from "../../domain/types.js";

export class InMemoryFraudRuleRepository implements FraudRuleRepository {
  public async getEnabledRules(): Promise<RuleConfigRecord[]> {
    return [
      {
        name: "VelocityRule",
        enabled: true,
        weight: 35,
        conditions: {
          threshold1s: 3,
          threshold1m: 10,
          threshold1h: 40,
          threshold24h: 200
        }
      },
      { name: "GeoRule", enabled: true, weight: 25, conditions: { maxDistanceKm: 1000 } },
      { name: "AmountRule", enabled: true, weight: 20, conditions: { zScoreThreshold: 3 } },
      { name: "TimeRule", enabled: true, weight: 10, conditions: { gaussianThreshold: 3 } },
      { name: "DeviceRule", enabled: true, weight: 15, conditions: {} }
    ];
  }

  public async getThresholdConfig(): Promise<RuleThresholdConfig> {
    return {
      reviewThreshold: 40,
      blockThreshold: 75,
      earlyExitScore: DEFAULT_EARLY_EXIT_SCORE,
      multiTriggerBoost: 0.2
    };
  }
}
