import { BaseRule } from "../BaseRule.js";
import type {
  RuleConfigRecord,
  RuleEvaluationResult,
  TransactionContext,
  UserRiskProfile
} from "../../types.js";

export class DeviceRule extends BaseRule {
  public async evaluate(
    context: TransactionContext,
    profile: UserRiskProfile
  ): Promise<RuleEvaluationResult> {
    const isMissing = !context.deviceFingerprint;
    const isNewDevice =
      !!context.deviceFingerprint &&
      !!profile.lastDeviceFingerprint &&
      context.deviceFingerprint !== profile.lastDeviceFingerprint;

    const triggered = isMissing || isNewDevice;

    return {
      rule: this.name,
      triggered,
      weightedScore: triggered ? this.weight : 0,
      reason: triggered ? "New or missing device fingerprint" : undefined,
      details: {
        isMissing,
        isNewDevice
      }
    };
  }
}

export function createRule(config: RuleConfigRecord): BaseRule {
  return new DeviceRule(config);
}
