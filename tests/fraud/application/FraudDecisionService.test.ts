import { FraudDecisionService } from "../../../src/modules/fraud/application/FraudDecisionService.js";
import type { BaseRule } from "../../../src/modules/fraud/domain/rules/BaseRule.js";
import { RuleChain } from "../../../src/modules/fraud/application/rule-engine/RuleChain.js";

describe("FraudDecisionService", () => {
  it("should return BLOCK when score reaches block threshold", async () => {
    // Arrange
    const highRiskRule: BaseRule = {
      name: "VelocityRule",
      weight: 80,
      conditions: {},
      evaluate: async () => ({
        rule: "VelocityRule",
        triggered: true,
        weightedScore: 80
      })
    };

    const chain = new RuleChain([highRiskRule]);
    const service = new FraudDecisionService();

    // Act
    const result = await service.decide(
      chain,
      {
        transactionId: "tx-1",
        userId: "user-1",
        amount: 999,
        timestamp: new Date()
      },
      {
        meanAmount: 100,
        stdDeviationAmount: 10,
        usualHourMean: 11,
        usualHourStdDeviation: 2
      },
      {
        reviewThreshold: 40,
        blockThreshold: 50,
        earlyExitScore: 95,
        multiTriggerBoost: 0.2
      }
    );

    // Assert
    expect(result.decision).toBe("BLOCK");
    expect(result.triggeredRules).toContain("VelocityRule");
  });
});
