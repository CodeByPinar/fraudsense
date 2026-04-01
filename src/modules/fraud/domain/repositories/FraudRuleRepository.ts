import type { RuleConfigRecord, RuleThresholdConfig } from "../types.js";

export interface FraudRuleRepository {
  getEnabledRules(): Promise<RuleConfigRecord[]>;
  getThresholdConfig(): Promise<RuleThresholdConfig>;
}
