import { BayesianScorer } from "../../../src/modules/fraud/application/scoring/BayesianScorer.js";

describe("BayesianScorer", () => {
  it("should return zero when no rules are triggered", () => {
    // Arrange
    const scorer = new BayesianScorer();

    // Act
    const score = scorer.calculateScore(
      [
        { rule: "VelocityRule", triggered: false, weightedScore: 0 },
        { rule: "GeoRule", triggered: false, weightedScore: 0 }
      ],
      0.2
    );

    // Assert
    expect(score).toBe(0);
  });

  it("should increase score when two or more rules are triggered", () => {
    // Arrange
    const scorer = new BayesianScorer();

    // Act
    const score = scorer.calculateScore(
      [
        { rule: "VelocityRule", triggered: true, weightedScore: 30 },
        { rule: "GeoRule", triggered: true, weightedScore: 30 }
      ],
      0.2
    );

    // Assert
    expect(score).toBeGreaterThanOrEqual(54);
  });
});
