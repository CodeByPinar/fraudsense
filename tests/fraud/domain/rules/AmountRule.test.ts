import { AmountRule } from "../../../../src/modules/fraud/domain/rules/implementations/AmountRule.js";

describe("AmountRule", () => {
  it("should trigger when amount z-score exceeds threshold", async () => {
    // Arrange
    const rule = new AmountRule({
      name: "AmountRule",
      enabled: true,
      weight: 20,
      conditions: { zScoreThreshold: 3 }
    });

    // Act
    const result = await rule.evaluate(
      {
        transactionId: "tx-1",
        userId: "user-1",
        amount: 500,
        timestamp: new Date()
      },
      {
        meanAmount: 100,
        stdDeviationAmount: 50,
        usualHourMean: 12,
        usualHourStdDeviation: 2
      }
    );

    // Assert
    expect(result.triggered).toBe(true);
    expect(result.weightedScore).toBe(20);
  });

  it("should not trigger when amount is within user baseline", async () => {
    // Arrange
    const rule = new AmountRule({
      name: "AmountRule",
      enabled: true,
      weight: 20,
      conditions: { zScoreThreshold: 3 }
    });

    // Act
    const result = await rule.evaluate(
      {
        transactionId: "tx-2",
        userId: "user-1",
        amount: 120,
        timestamp: new Date()
      },
      {
        meanAmount: 100,
        stdDeviationAmount: 20,
        usualHourMean: 12,
        usualHourStdDeviation: 2
      }
    );

    // Assert
    expect(result.triggered).toBe(false);
    expect(result.weightedScore).toBe(0);
  });
});
